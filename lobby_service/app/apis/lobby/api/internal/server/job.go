package server

import (
	"context"
	"time"

	"apps/app/apis/lobby/api/internal/repository"
	"apps/pkg/xlog"
)

// StartPayments runs the MVP payment simulator against durable pending orders.
func StartPayments(ctx context.Context, store repository.RechargeStore) <-chan struct{} {
	done := make(chan struct{})
	go func() {
		defer close(done)
		ticker := time.NewTicker(200 * time.Millisecond)
		defer ticker.Stop()
		for {
			if err := store.SettleDue(ctx, time.Now().UTC()); err != nil && ctx.Err() == nil {
				xlog.Error(ctx, "payment settlement failed", "error", err)
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
