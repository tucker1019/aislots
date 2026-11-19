package postgres

import (
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
)

type LossCleanupProgress struct {
	Candidates, Eligible, Receipts, Frames, Spins, Tickets int64
}

// ClearExperienceLossReplays uses an operator-supplied experience UID snapshot
// exported from the lobby. It never reads that database or changes money,
// statistics, or request identifiers. Newer receipts are left for a later run.
func (s *Store) ClearExperienceLossReplays(ctx context.Context, app, key string, uids []string, batchSize, maxBatches int, apply bool, backupDir string, report func(LossCleanupProgress)) error {
	return s.clearExperienceLossShard(ctx, app, key, uids, batchSize, maxBatches, apply, backupDir, report, 0, 1)
}

// Concurrent workers own disjoint heap windows. Row locks and the marker still
// protect a receipt that is moved into another window by a concurrent update.
func (s *Store) ClearExperienceLossReplaysConcurrent(ctx context.Context, app, key string, uids []string, batchSize, maxBatches, workers int, apply bool, backupDir string, report func(LossCleanupProgress)) error {
	if workers < 1 || workers > 4 {
		return fmt.Errorf("workers must be 1..4")
	}
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	var wg sync.WaitGroup
	var mu sync.Mutex
	var first error
	collect := func(p LossCleanupProgress) {
		mu.Lock()
		defer mu.Unlock()
		if report != nil {
			report(p)
		}
	}
	for shard := 0; shard < workers; shard++ {
		wg.Add(1)
		go func(shard int) {
			defer wg.Done()
			err := s.clearExperienceLossShard(ctx, app, key, uids, batchSize, maxBatches, apply, backupDir, collect, shard, workers)
			if err != nil {
				mu.Lock()
				if first == nil {
					first = err
				}
				mu.Unlock()
				cancel()
			}
		}(shard)
	}
	wg.Wait()
	return first
}

func (s *Store) clearExperienceLossShard(ctx context.Context, app, key string, uids []string, batchSize, maxBatches int, apply bool, backupDir string, report func(LossCleanupProgress), shard, workers int) error {

	if app == "" || key == "" || len(uids) == 0 || batchSize < 1 || batchSize > 10000 || maxBatches < 0 {
		return fmt.Errorf("platform, experience UID list and valid batch limits are required")
	}
	if apply && backupDir == "" {
		return fmt.Errorf("backup directory is required when applying history cleanup")
	}
	if apply {
		if err := os.MkdirAll(backupDir, 0700); err != nil {
			return err
		}
	}
	conn, err := s.pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()
	defer func() {
		cleanup, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if _, e := conn.Exec(cleanup, `DROP TABLE IF EXISTS loss_cleanup_scopes`); e != nil {
			_ = conn.Conn().Close(cleanup)
		}
	}()
	if _, err = conn.Exec(ctx, `CREATE TEMP TABLE loss_cleanup_scopes AS SELECT scope,game_id,scope::jsonb AS player
 FROM spin_request_tokens WHERE scope::jsonb->'subject'->>'appname'=$1 AND scope::jsonb->'subject'->>'appkey'=$2
 AND scope::jsonb->'subject'->>'uid'=ANY($3::text[])`, app, key, uids); err != nil {
		return err
	}
	if _, err = conn.Exec(ctx, `CREATE UNIQUE INDEX ON loss_cleanup_scopes(scope,game_id); ANALYZE loss_cleanup_scopes`); err != nil {
		return err
	}

	var cutoff time.Time
	var blocks int64
	if err = conn.QueryRow(ctx, `SELECT now(),pg_relation_size('spin_request_receipts')/current_setting('block_size')::bigint`).Scan(&cutoff, &blocks); err != nil {
		return err
	}
	// Range-scan the heap in bounded windows. Receipt insertion order follows
	// settlement time, so related ticket/result/frame pages stay near each other
	// in cache. No CTID is persisted or reused across transactions or runs.
	blocksPerBatch := int64(batchSize / 4)
	if blocksPerBatch < 1 {
		blocksPerBatch = 1
	}
	for start, batch := int64(shard)*blocksPerBatch, 0; start < blocks && (maxBatches == 0 || batch < maxBatches); batch++ {
		end := start + blocksPerBatch
		if end > blocks {
			end = blocks
		}
		p, err := clearLossBatch(ctx, conn, app, key, start, end, cutoff, apply, backupDir)
		if err != nil {
			return err
		}
		if report != nil {
			report(p)
		}
		start += int64(workers) * blocksPerBatch
	}
	return nil
}

func clearLossBatch(ctx context.Context, conn interface {
	Begin(context.Context) (pgx.Tx, error)
}, app, key string, start, end int64, cutoff time.Time, apply bool, backupDir string) (LossCleanupProgress, error) {
	var out LossCleanupProgress
	tx, err := conn.Begin(ctx)
	if err != nil {
		return out, err
	}
	defer tx.Rollback(context.Background())
	if _, err = tx.Exec(ctx, `SET LOCAL statement_timeout='30s'; SET LOCAL lock_timeout='3s'`); err != nil {
		return out, err
	}
	// Physical locations are used only to select and lock this batch. All
	// subsequent checks, backups and mutations use stable application keys.
	_, err = tx.Exec(ctx, `CREATE TEMP TABLE loss_cleanup_page ON COMMIT DROP AS
 SELECT r.scope,r.game_id,r.request_id,r.data,c.player FROM spin_request_receipts r
 JOIN loss_cleanup_scopes c ON c.scope=r.scope AND c.game_id=r.game_id
 WHERE r.ctid >= $1::tid AND r.ctid < $2::tid AND r.created_at<$3
 AND COALESCE(r.data->>'ReplayOmitted','false')<>'true'
 AND (r.data->>'StorageVersion'='1' OR (
 r.data->'Frame'->>'mode'='base' AND r.data->'Frame'->>'nextAction'='complete'
 AND r.data->'Frame'->>'spinIndex'='0' AND r.data->'Frame'->>'stepIndex'='1'
 AND COALESCE((r.data->'Frame'->>'winAmount')::numeric,0)=0
 AND COALESCE((r.data->'Frame'->>'totalWinAmount')::numeric,0)=0))
 ORDER BY r.ctid FOR UPDATE OF r SKIP LOCKED`, fmt.Sprintf("(%d,0)", start), fmt.Sprintf("(%d,0)", end), cutoff)
	if err != nil {
		return out, err
	}
	if _, err = tx.Exec(ctx, `ANALYZE loss_cleanup_page`); err != nil {
		return out, err
	}
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM loss_cleanup_page`).Scan(&out.Candidates); err != nil || out.Candidates == 0 {
		return out, err
	}

	// Only direct base losses: preserve all free/respin/continuation histories,
	// even when an individual step or the complete feature happened to pay zero.
	_, err = tx.Exec(ctx, `CREATE TEMP TABLE loss_cleanup_eligible ON COMMIT DROP AS
 SELECT p.scope,p.game_id,p.request_id,t.id,t.data FROM loss_cleanup_page p
 JOIN bet_tickets t ON t.id=p.data->'Frame'->>'betId' AND t.data->'Player'=p.player AND t.data->>'GameID'=p.game_id
 LEFT JOIN spin_steps f ON p.data->>'StorageVersion'='1' AND f.bet_id=t.id AND f.spin_index=0 AND f.step_index=1
 WHERE t.appname=$1 AND t.appkey=$2 AND t.status='complete'
 AND t.data->>'TotalWin'='0' AND t.data->>'SpinIndex'='0' AND t.data->>'StepIndex'='1'
 AND COALESCE(t.data->>'ReplayOmitted','false')<>'true'
 AND p.data->'Frame'->>'spinIndex'='0' AND p.data->'Frame'->>'stepIndex'='1'
 AND COALESCE((p.data->'Frame'->>'winAmount')::numeric,0)=0 AND COALESCE((p.data->'Frame'->>'totalWinAmount')::numeric,0)=0
 AND (p.data->>'StorageVersion' IS DISTINCT FROM '1' OR f.response IS NOT NULL)
 AND COALESCE(f.response,p.data->'Frame')->>'nextAction'='complete' AND COALESCE(f.response,p.data->'Frame')->>'mode'='base'
 AND COALESCE((COALESCE(f.response,p.data->'Frame')->>'winAmount')::numeric,0)=0 AND COALESCE((COALESCE(f.response,p.data->'Frame')->>'totalWinAmount')::numeric,0)=0
 AND COALESCE((COALESCE(f.response,p.data->'Frame')->>'triggeredFree')::boolean,false)=false
 AND COALESCE((COALESCE(f.response,p.data->'Frame')->>'awardedFreeSpins')::int,0)=0 AND COALESCE((COALESCE(f.response,p.data->'Frame')->>'freeRemaining')::int,0)=0
 AND NOT EXISTS(SELECT 1 FROM spin_steps x WHERE x.bet_id=t.id AND (x.spin_index<>0 OR x.step_index<>1))
 AND NOT EXISTS(SELECT 1 FROM game_spins x WHERE x.bet_id=t.id AND x.spin_index<>0)
 AND NOT EXISTS(SELECT 1 FROM game_auto_rounds a WHERE a.appname=t.appname AND a.appkey=t.appkey AND a.uid=t.uid
  AND NOT a.done AND (a.bet_id=t.id OR (a.bet_id='' AND a.spin_token=p.request_id)))
 AND NOT EXISTS(SELECT 1 FROM lobby_pending_settlements pending WHERE pending.data->'Request'->>'betId'=t.id)
 FOR UPDATE OF t SKIP LOCKED`, app, key)
	if err != nil {
		return out, err
	}
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM loss_cleanup_eligible`).Scan(&out.Eligible); err != nil {
		return out, err
	}
	if _, err = tx.Exec(ctx, `ANALYZE loss_cleanup_eligible`); err != nil {
		return out, err
	}
	if !apply {
		return out, nil
	}
	if out.Eligible > 0 {
		if err = backupLossBatch(ctx, tx, backupDir); err != nil {
			return out, err
		}
	}
	// Retain the legacy-readable receipt envelope, next token, and original
	// balance. Remove StorageVersion before deleting compact receipts' sources.
	r, err := tx.Exec(ctx, `UPDATE spin_request_receipts r SET data=(r.data-'StorageVersion') || jsonb_build_object(
 'ReplayOmitted',true,'Frame',jsonb_build_object(
 'betId',r.data->'Frame'->'betId','spinIndex',0,'stepIndex',1,'mode','base','status','ready','nextAction','complete',
 'betAmount',COALESCE(r.data->'Frame'->'betAmount',p.data->'Amount'),'balance',r.data->'Frame'->'balance',
 'requestId',r.data->'Frame'->'requestId','nextRequestId',r.data->'Frame'->'nextRequestId'))
 FROM loss_cleanup_eligible p WHERE r.scope=p.scope AND r.game_id=p.game_id AND r.request_id=p.request_id`)
	if err != nil {
		return out, err
	}
	out.Receipts = r.RowsAffected()
	r, err = tx.Exec(ctx, `DELETE FROM spin_steps f USING loss_cleanup_eligible p WHERE f.bet_id=p.id`)
	if err != nil {
		return out, err
	}
	out.Frames = r.RowsAffected()
	r, err = tx.Exec(ctx, `DELETE FROM game_spins g USING loss_cleanup_eligible p WHERE g.bet_id=p.id`)
	if err != nil {
		return out, err
	}
	out.Spins = r.RowsAffected()
	r, err = tx.Exec(ctx, `UPDATE bet_tickets t SET data=t.data || '{"ReplayOmitted":true}'::jsonb FROM loss_cleanup_eligible p WHERE t.id=p.id`)
	if err != nil {
		return out, err
	}
	out.Tickets = r.RowsAffected()
	return out, tx.Commit(ctx)
}

// Save a durable, compressed copy of exactly the rows about to be changed.
// Each batch is independently readable; a failed backup rolls back the batch.
func backupLossBatch(ctx context.Context, tx pgx.Tx, dir string) error {
	rows, err := tx.Query(ctx, `SELECT jsonb_build_object('ticket',to_jsonb(t),'receipt',to_jsonb(r),
 'frames',(SELECT jsonb_agg(to_jsonb(f)) FROM spin_steps f WHERE f.bet_id=p.id),
 'spins',(SELECT jsonb_agg(to_jsonb(g)) FROM game_spins g WHERE g.bet_id=p.id))
 FROM loss_cleanup_eligible p JOIN bet_tickets t ON t.id=p.id
 JOIN spin_request_receipts r ON r.scope=p.scope AND r.game_id=p.game_id AND r.request_id=p.request_id`)
	if err != nil {
		return err
	}
	defer rows.Close()
	f, err := os.CreateTemp(dir, ".loss-batch-*.jsonl.gz")
	if err != nil {
		return err
	}
	defer f.Close()
	name := f.Name()
	complete := false
	defer func() {
		if !complete {
			_ = os.Remove(name)
		}
	}()
	gz, err := gzip.NewWriterLevel(f, gzip.BestSpeed)
	if err != nil {
		return err
	}
	enc := json.NewEncoder(gz)
	for rows.Next() {
		var raw json.RawMessage
		if err = rows.Scan(&raw); err != nil {
			return err
		}
		if err = enc.Encode(raw); err != nil {
			return err
		}
	}
	if err = rows.Err(); err != nil {
		return err
	}
	if err = gz.Close(); err != nil {
		return err
	}
	if err = f.Sync(); err != nil {
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	if err = os.Rename(name, filepath.Join(dir, filepath.Base(name)[1:])); err != nil {
		return err
	}
	d, err := os.Open(dir)
	if err != nil {
		return err
	}
	defer d.Close()
	if err = d.Sync(); err != nil {
		return err
	}
	complete = true
	return nil
}
