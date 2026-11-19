package postgres

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/jackc/pgx/v5"
)

type ReceiptCompactionProgress struct {
	Scanned, Eligible, Compacted, Skipped int
	BeforeJSONBytes, AfterJSONBytes       int64
}

// CompactReceiptHistory converts legacy receipts in short keyset-paginated
// transactions. It never changes spin_steps. maxBatches=0 scans to the end;
// dry runs use read-only transactions and report eligible logical JSON bytes.
// Call only after every writer/reader supports compact receipts.
func (s *Store) CompactReceiptHistory(ctx context.Context, batchSize, maxBatches int, apply bool, report func(ReceiptCompactionProgress)) error {
	if batchSize < 1 || batchSize > 10000 || maxBatches < 0 {
		return fmt.Errorf("batch size must be 1..10000 and max batches must be nonnegative")
	}
	var scope, game, id string
	for batch := 0; maxBatches == 0 || batch < maxBatches; batch++ {
		progress, nextScope, nextGame, nextID, err := s.compactReceiptBatch(ctx, batchSize, apply, scope, game, id)
		if err != nil {
			return err
		}
		if progress.Scanned == 0 {
			return nil
		}
		if report != nil {
			report(progress)
		}
		scope, game, id = nextScope, nextGame, nextID
	}
	return nil
}

func (s *Store) compactReceiptBatch(ctx context.Context, limit int, apply bool, scope, game, id string) (ReceiptCompactionProgress, string, string, string, error) {
	var out ReceiptCompactionProgress
	options := pgx.TxOptions{}
	if !apply {
		options.AccessMode = pgx.ReadOnly
	}
	tx, err := s.pool.BeginTx(ctx, options)
	if err != nil {
		return out, scope, game, id, err
	}
	defer tx.Rollback(context.Background())
	if _, err = tx.Exec(ctx, `SET LOCAL statement_timeout='30s'; SET LOCAL lock_timeout='3s'`); err != nil {
		return out, scope, game, id, err
	}
	rows, err := tx.Query(ctx, `SELECT r.scope,r.game_id,r.request_id,r.data,f.response,
 COALESCE(((r.data->'Frame') - ARRAY['requestId','nextRequestId','next','balance'])
  = (f.response - ARRAY['requestId','nextRequestId','next','balance']),false)
FROM spin_request_receipts r LEFT JOIN spin_steps f
 ON f.bet_id=r.data->'Frame'->>'betId'
 AND f.spin_index=(r.data->'Frame'->>'spinIndex')::integer
 AND f.step_index=(r.data->'Frame'->>'stepIndex')::integer
WHERE (r.scope,r.game_id,r.request_id)>($1,$2,$3)
 AND COALESCE(r.data->>'StorageVersion','0')='0'
 AND COALESCE(r.data->>'ReplayOmitted','false')<>'true'
ORDER BY r.scope,r.game_id,r.request_id LIMIT $4`, scope, game, id, limit)
	if err != nil {
		return out, scope, game, id, err
	}
	type candidate struct {
		scope, game, id string
		raw, compact    []byte
	}
	var candidates []candidate
	for rows.Next() {
		var c candidate
		var frame []byte
		var matches bool
		if err = rows.Scan(&c.scope, &c.game, &c.id, &c.raw, &frame, &matches); err != nil {
			break
		}
		out.Scanned++
		scope, game, id = c.scope, c.game, c.id
		if !matches {
			out.Skipped++
			continue
		}
		var r map[string]json.RawMessage
		var encoded map[string]json.RawMessage
		receipt, e := decodeSpinReceipt(c.raw, nil)
		if e != nil {
			err = e
			break
		}
		compact, e := encodeSpinReceipt(receipt)
		if e != nil {
			err = e
			break
		}
		if e = json.Unmarshal(c.raw, &r); e == nil {
			e = json.Unmarshal(compact, &encoded)
		}
		if e != nil {
			err = e
			break
		}
		// Preserve unknown receipt-level metadata; the frame body is replaced
		// only after PostgreSQL has verified equality with its immutable source.
		r["StorageVersion"], r["Frame"] = encoded["StorageVersion"], encoded["Frame"]
		c.compact, err = json.Marshal(r)
		if err != nil {
			break
		}
		out.Eligible++
		out.BeforeJSONBytes += int64(len(c.raw))
		out.AfterJSONBytes += int64(len(c.compact))
		candidates = append(candidates, c)
	}
	rows.Close()
	if err == nil {
		err = rows.Err()
	}
	if err != nil {
		return out, scope, game, id, err
	}
	if apply {
		for _, c := range candidates {
			result, e := tx.Exec(ctx, `UPDATE spin_request_receipts SET data=$4 WHERE scope=$1 AND game_id=$2 AND request_id=$3 AND data=$5`, c.scope, c.game, c.id, c.compact, c.raw)
			if e != nil {
				return out, scope, game, id, e
			}
			if result.RowsAffected() != 1 {
				return out, scope, game, id, fmt.Errorf("receipt changed during compaction; batch rolled back")
			}
			out.Compacted++
		}
	}
	err = tx.Commit(ctx)
	return out, scope, game, id, err
}

type OrderRemovalReport struct {
	Exists, Removed bool
	Bytes           int64
}

// RemoveDuplicateOrders is an explicit maintenance operation, never a startup
// migration. Every order must already exist unchanged in bet_tickets. DROP uses
// RESTRICT so unknown database dependencies abort the operation.
func (s *Store) RemoveDuplicateOrders(ctx context.Context, apply bool) (OrderRemovalReport, error) {
	var out OrderRemovalReport
	options := pgx.TxOptions{}
	if !apply {
		options.AccessMode = pgx.ReadOnly
	}
	tx, err := s.pool.BeginTx(ctx, options)
	if err != nil {
		return out, err
	}
	defer tx.Rollback(context.Background())
	if _, err = tx.Exec(ctx, `SET LOCAL statement_timeout='60s'; SET LOCAL lock_timeout='3s'`); err != nil {
		return out, err
	}
	if err = tx.QueryRow(ctx, `SELECT to_regclass('bet_orders') IS NOT NULL`).Scan(&out.Exists); err != nil || !out.Exists {
		return out, err
	}
	if apply {
		if _, err = tx.Exec(ctx, `LOCK TABLE bet_orders IN ACCESS EXCLUSIVE MODE`); err != nil {
			return out, err
		}
	}
	if err = tx.QueryRow(ctx, `SELECT pg_total_relation_size('bet_orders')`).Scan(&out.Bytes); err != nil {
		return out, err
	}
	var differs bool
	err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM bet_orders o LEFT JOIN bet_tickets t ON t.id=o.bet_id WHERE t.id IS NULL OR o.status IS DISTINCT FROM t.status OR (o.data IS DISTINCT FROM t.data AND NOT(COALESCE(t.data->>'ReplayOmitted','false')='true' AND o.data=t.data-'ReplayOmitted')))`).Scan(&differs)
	if err != nil {
		return out, err
	}
	if differs {
		return out, fmt.Errorf("bet_orders contains unmatched data; nothing removed")
	}
	if apply {
		if _, err = tx.Exec(ctx, `DROP TABLE bet_orders RESTRICT`); err != nil {
			return out, err
		}
		out.Removed = true
	}
	return out, tx.Commit(ctx)
}
