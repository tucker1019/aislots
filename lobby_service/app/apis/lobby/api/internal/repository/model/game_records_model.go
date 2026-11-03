package model

import (
	"context"
	"database/sql"
	"time"

	"gorm.io/gorm"
)

type GameRecordRow struct {
	BetID     string
	GameID    string
	CreatedAt time.Time
	BetAmount int64
	Profit    int64
}
type GameRecordSummary struct {
	Count     int64
	BetAmount int64
	Profit    int64
}

// Group all confirmed frames before filtering by the paid wager date. Free rounds stay in the original bet.
func (m *GameModel) Records(ctx context.Context, uid int64, from, to time.Time, page int, gameIDs []string) ([]GameRecordRow, GameRecordSummary, error) {
	var rows []GameRecordRow
	var summary GameRecordSummary
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		grouped := func() *gorm.DB {
			query := tx.Model(&LobbyGameSettlement{})
			if gameIDs != nil {
				query = query.Where("game_id IN ?", gameIDs)
			}
			return query.Select("game_id, bet_id, MIN(created_at) AS created_at, SUM(debit) AS bet_amount, SUM(credit) - SUM(debit) AS profit").Where("uid = ? AND status = ?", uid, "confirmed").Group("game_id, bet_id").Having("SUM(debit) > 0 AND MIN(created_at) >= ? AND MIN(created_at) < ?", from, to)
		}
		if e := tx.Table("(?) AS bets", grouped()).Select("COUNT(*) AS count, COALESCE(SUM(bet_amount),0) AS bet_amount, COALESCE(SUM(profit),0) AS profit").Scan(&summary).Error; e != nil {
			return e
		}
		return tx.Table("(?) AS bets", grouped()).Order("created_at DESC, game_id DESC, bet_id DESC").Limit(21).Offset((page - 1) * 20).Scan(&rows).Error
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	return rows, summary, err
}
