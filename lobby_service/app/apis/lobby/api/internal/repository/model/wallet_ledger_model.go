package model

import (
	"context"
	"time"

	"gorm.io/gorm"
)

type WalletLedgerRow struct {
	LobbyCoinLedger
	GameID string
}

func (m *GameModel) ledgerQuery(ctx context.Context, uid int64) *gorm.DB {
	return m.DB.WithContext(ctx).Table("lobby_coin_ledger AS ledger").Select("ledger.*, settlement.game_id").Joins("LEFT JOIN lobby_game_settlements AS settlement ON settlement.request_id = ledger.order_id AND settlement.uid = ledger.uid AND ledger.source IN ('game_001','game_002')").Where("ledger.uid = ?", uid)
}

func (m *GameModel) Ledger(ctx context.Context, uid int64, from, to time.Time, sources, gameIDs []string, cursor int64) ([]WalletLedgerRow, error) {
	q := m.ledgerQuery(ctx, uid).Where("ledger.created_at >= ? AND ledger.created_at < ?", from, to)
	if sources != nil {
		q = q.Where("ledger.source IN ?", sources)
	}
	if gameIDs != nil {
		q = q.Where("settlement.game_id IN ?", gameIDs)
	}
	if cursor > 0 {
		q = q.Where("ledger.id < ?", cursor)
	}
	var rows []WalletLedgerRow
	e := q.Order("ledger.id DESC").Limit(21).Scan(&rows).Error
	return rows, e
}

func (m *GameModel) LedgerDetail(ctx context.Context, uid, id int64) (WalletLedgerRow, error) {
	var row WalletLedgerRow
	e := m.ledgerQuery(ctx, uid).Where("ledger.id = ?", id).Scan(&row).Error
	if e == nil && row.ID == 0 {
		e = gorm.ErrRecordNotFound
	}
	return row, e
}
