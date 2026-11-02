package server

import (
	"context"
	"time"

	"apps/app/apis/lobby/api/internal/repository"
	"apps/pkg/xlog"
)

func StartVIP(ctx context.Context, store repository.VIPStore) <-chan struct{} {
	done := make(chan struct{})
	go func() {
		defer close(done)
		ticker := time.NewTicker(time.Second)
		defer ticker.Stop()
		for {
			if err := store.TickVIP(ctx, time.Now().UTC()); err != nil && ctx.Err() == nil {
				xlog.Error(ctx, "VIP processing failed", "error", err)
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
