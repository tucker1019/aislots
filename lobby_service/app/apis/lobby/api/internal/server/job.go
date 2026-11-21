package server

import (
	"context"
	"time"

	"gorm.io/gorm"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository"
	"apps/app/apis/lobby/api/internal/repository/model"
	"apps/pkg/xlog"
)

func StartLeaderboardSettlement(ctx context.Context, db *gorm.DB, c config.Config) <-chan struct{} {
	done := make(chan struct{})
	go func() {
		defer close(done)
		settle := func() {
			loc := c.Checkin.Location()
			day := time.Now().In(loc).AddDate(0, 0, -1)
			store := &model.GameModel{DB: db, Location: loc}
			for _, board := range []string{"wins", "multiplier"} {
				if err := store.EnsurePlatformLeaderboardRewards(ctx, day, board, c.Leaderboard.Rewards); err != nil && ctx.Err() == nil {
					xlog.Error(ctx, "leaderboard settlement failed", "board", board, "error", err)
				}
			}
		}
		settle()
		ticker := time.NewTicker(time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				settle()
			}
		}
	}()
	return done
}

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

// StartRecommendations refreshes the 30-day recommendation materialization
// hourly. Reads never scan raw game history; they only use this table.
func StartRecommendations(ctx context.Context, store *model.RecommendationModel) <-chan struct{} {
	done := make(chan struct{})
	go func() {
		defer close(done)
		refresh := func() {
			if err := store.Rebuild(ctx, time.Now().UTC()); err != nil && ctx.Err() == nil {
				xlog.Error(ctx, "recommendation rebuild failed", "error", err)
			}
		}
		refresh()
		ticker := time.NewTicker(time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case now := <-ticker.C:
				_ = now
				refresh()
			}
		}
	}()
	return done
}
