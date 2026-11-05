package server

import (
	"context"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/pkg/xlog"

	"gorm.io/gorm"
)

// One dedicated advisory-lock connection owns dispatch across lobby instances.
func StartExperience(ctx context.Context, c config.Config, db *gorm.DB) <-chan struct{} {
	done := make(chan struct{})
	go func() {
		defer close(done)
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for {
			if err := experienceTick(ctx, c, db); err != nil && ctx.Err() == nil {
				xlog.Error(ctx, "experience round paused; original request retained", "error", err)
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

func experienceTick(ctx context.Context, c config.Config, db *gorm.DB) error {
	return experiencePoolTick(ctx, c, db)
}
