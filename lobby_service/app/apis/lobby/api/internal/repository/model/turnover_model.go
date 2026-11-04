package model

import (
	"context"

	"apps/app/apis/lobby/api/internal/config"
	"apps/pkg/xerr"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type TurnoverModel struct{ DB *gorm.DB }

// Configure atomically publishes future-credit rules; old entry snapshots never change.
func (m *TurnoverModel) Configure(ctx context.Context, c config.TurnoverConfig) error {
	if e := c.Validate(); e != nil {
		return e
	}
	return m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if e := tx.Exec(`SELECT pg_advisory_xact_lock(2026110401)`).Error; e != nil {
			return e
		}
		rows := make([]LobbyTurnoverRule, 0, len(config.TurnoverSources))
		for _, source := range config.TurnoverSources {
			rows = append(rows, LobbyTurnoverRule{Source: string(source), Multiplier: c.Multipliers[string(source)], Version: c.Version})
		}
		return tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "source"}}, DoUpdates: clause.AssignmentColumns([]string{"multiplier", "version"})}).Create(&rows).Error
	})
}

func (m *TurnoverModel) Remaining(ctx context.Context, uid int64) (int64, error) {
	var value int64
	e := m.DB.WithContext(ctx).Raw(`SELECT COALESCE((SELECT remaining FROM lobby_turnover_balances WHERE uid=?),0)`, uid).Scan(&value).Error
	return value, databaseError(e)
}

func (m *WithdrawalModel) Remaining(ctx context.Context, uid int64) (int64, error) {
	if m == nil {
		return 0, xerr.ErrInvalid
	}
	return (&TurnoverModel{DB: m.DB}).Remaining(ctx, uid)
}
