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

// activeItems runs under the same wallet lock as the withdrawal check.
// Apply completed turnover to the oldest credits first. The unpaid balance
// therefore belongs to the newest credits in the current turnover cycle.
func (m *TurnoverModel) activeItems(ctx context.Context, uid, remaining int64) ([]xerr.TurnoverItem, error) {
	var entries []LobbyTurnoverEntry
	err := m.DB.WithContext(ctx).Raw(`
 SELECT e.source, e.amount, e.added, COALESCE(l.created_at,e.created_at) AS created_at
 FROM lobby_turnover_entries e
 LEFT JOIN lobby_coin_ledger l ON l.id=e.credit_ledger_id
 WHERE e.uid=? AND e.added>0 AND e.id>COALESCE(
  (SELECT MAX(id) FROM lobby_turnover_entries WHERE uid=? AND remaining_after=0),0)
 ORDER BY e.id DESC`, uid, uid).Scan(&entries).Error
	if err != nil {
		return nil, databaseError(err)
	}
	items := make([]xerr.TurnoverItem, 0, len(entries))
	for _, entry := range entries {
		unpaid := min(remaining, entry.Added)
		remaining -= unpaid
		items = append(items, xerr.TurnoverItem{
			Source: entry.Source, Amount: entry.Amount, Required: entry.Added,
			Completed: entry.Added - unpaid, CreatedAt: entry.CreatedAt,
		})
	}
	return items, nil
}
