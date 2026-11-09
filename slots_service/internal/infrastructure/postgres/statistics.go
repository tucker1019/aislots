package postgres

import (
	"aislots/slots_service/internal/infrastructure/lobby"
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"log/slog"
	"strconv"
	"time"
)

// Per-player stream locks allow other players to progress when one delivery needs retry.
func (s *Store) FlushStatistics(ctx context.Context) error {
	return s.flushStatistics(ctx, time.Time{})
}

func (s *Store) flushStatistics(ctx context.Context, stopAt time.Time) error {
	budgetSpent := func() bool { return !stopAt.IsZero() && !time.Now().Before(stopAt) }
	if s.lobby == nil || budgetSpent() {
		return nil
	}
	conn, e := s.pool.Acquire(ctx)
	if e != nil {
		return e
	}
	defer conn.Release()
	rows, e := conn.Query(ctx, `SELECT game_id,uid FROM (SELECT game_id,uid,MIN(id) AS first_id FROM game_statistics_outbox WHERE delivered_at IS NULL GROUP BY game_id,uid) pending ORDER BY first_id LIMIT 50`)
	if e != nil {
		return e
	}
	var streams [][2]string
	for rows.Next() {
		var stream [2]string
		if e = rows.Scan(&stream[0], &stream[1]); e != nil {
			rows.Close()
			return e
		}
		streams = append(streams, stream)
	}
	e = rows.Err()
	rows.Close()
	if e != nil {
		return e
	}
	var firstError error
	for _, stream := range streams {
		if budgetSpent() {
			break
		}
		scope, _ := json.Marshal(stream)
		var locked bool
		if e = conn.QueryRow(ctx, "SELECT pg_try_advisory_lock(hashtextextended($1,20261103))", string(scope)).Scan(&locked); e != nil {
			return e
		}
		if !locked {
			continue
		}
		runErr := func() error {
			for i := 0; i < 20 && !budgetSpent(); i++ {
				var id int64
				var event lobby.Completion
				event.GameID = stream[0]
				var parseErr error
				event.UID, parseErr = strconv.ParseInt(stream[1], 10, 64)
				if parseErr != nil {
					return parseErr
				}
				e := conn.QueryRow(ctx, `SELECT id,bet_id,sequence,bet_amount,win_amount,started_at,ended_at FROM game_statistics_outbox WHERE delivered_at IS NULL AND game_id=$1 AND uid=$2 ORDER BY sequence LIMIT 1`, stream[0], stream[1]).Scan(&id, &event.BetID, &event.Sequence, &event.BetAmount, &event.WinAmount, &event.StartedAt, &event.EndedAt)
				if e == pgx.ErrNoRows {
					return nil
				}
				if e != nil {
					return e
				}
				if e = s.lobby.Complete(ctx, event); e != nil {
					return e
				}
				if _, e = conn.Exec(ctx, "UPDATE game_statistics_outbox SET delivered_at=now() WHERE id=$1", id); e != nil {
					return e
				}
			}
			return nil
		}()
		cleanup, cancel := context.WithTimeout(context.Background(), time.Second)
		_, unlockErr := conn.Exec(cleanup, "SELECT pg_advisory_unlock(hashtextextended($1,20261103))", string(scope))
		cancel()
		if unlockErr != nil {
			_ = conn.Conn().Close(context.Background())
			return unlockErr
		}
		if runErr != nil && firstError == nil {
			firstError = runErr
		}
		if ctx.Err() != nil {
			return ctx.Err()
		}
	}
	return firstError
}
func (s *Store) RunStatistics(ctx context.Context) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	var next time.Time
	backoff := time.Second
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if time.Now().Before(next) {
				continue
			}
			// Stop taking new events after 15s and let the in-flight delivery finish.
			stopAt := time.Now().Add(15 * time.Second)
			run, cancel := context.WithDeadline(ctx, stopAt.Add(10*time.Second))
			err := s.flushStatistics(run, stopAt)
			cancel()
			if err != nil && ctx.Err() == nil {
				slog.Warn("game statistics delivery pending; will retry", "error", err)
				backoff *= 2
				if backoff > 30*time.Second {
					backoff = 30 * time.Second
				}
				next = time.Now().Add(backoff)
			} else {
				backoff = time.Second
				next = time.Time{}
			}
		}
	}
}
