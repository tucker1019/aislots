package server

import (
	"context"
	"time"

	"apps/app/apis/lobby/api/internal/repository"
	"apps/pkg/xlog"
)

func StartAgent(ctx context.Context, store repository.AgentStore) <-chan struct{} {
	done := make(chan struct{})
	go func() {
		defer close(done)
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for {
			run, cancel := context.WithTimeout(ctx, 30*time.Second)
			e := store.Tick(run, time.Now().UTC())
			cancel()
			if e != nil && ctx.Err() == nil {
				xlog.Error(ctx, "agent processing pending; will retry", "error", e)
			}
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()
	return done
}
