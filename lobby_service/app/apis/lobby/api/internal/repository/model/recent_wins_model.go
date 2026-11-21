package model

import (
	"context"
	"time"
)

// RecentWinView contains trusted server identity, never serialized directly to browsers.
type RecentWinView struct {
	ID, GameID, BetID, Nickname, BetAmount, WinAmount, Multiplier string
	AvatarID                                                      int32
	UID                                                           int64
	Anonymous                                                     bool
	EndedAt                                                       time.Time
}

type ReplayOrder struct {
	GameID string
	BetID  string
	UID    int64
}

// ReadRecentWins uses the eligibility partial index and joins profiles after LIMIT.
// It never reads raw frames or filters out experience accounts.
func (m *GameModel) ReadRecentWins(ctx context.Context, games []string, now time.Time) ([]RecentWinView, error) {
	rows := []RecentWinView{}
	if len(games) == 0 {
		return rows, nil
	}
	err := m.DB.WithContext(ctx).Raw(`SELECT c.platform_order_id::text AS id,c.game_id,c.bet_id,c.uid,COALESCE(NULLIF(c.leaderboard_nickname,''),u.nickname) AS nickname,u.avatar_id,c.bet_amount::text,c.win_amount::text,
 ROUND(c.win_amount::numeric/c.bet_amount,2)::text AS multiplier,c.ended_at,(NOT c.leaderboard_participating OR c.leaderboard_anonymous) AS anonymous
 FROM (SELECT * FROM lobby_game_completions
 WHERE included AND ended_at >= ? AND ended_at <= ? AND game_id IN ?
 AND (win_amount::numeric >= bet_amount::numeric*20
 OR (win_amount >= 20000000 AND win_amount::numeric >= bet_amount::numeric*5))
 ORDER BY ended_at DESC,platform_order_id DESC LIMIT 50) c
 JOIN lobby_users u ON u.uid=c.uid ORDER BY c.ended_at DESC,c.platform_order_id DESC`,
		now.Add(-time.Hour), now, games).Scan(&rows).Error
	return rows, err
}

// ReadReplayOrder authorizes a replay from the durable completion record, not the hourly broadcast cache.
func (m *GameModel) ReadReplayOrder(ctx context.Context, platformOrderID int64) (ReplayOrder, bool, error) {
	var row ReplayOrder
	result := m.DB.WithContext(ctx).Raw(`SELECT game_id,bet_id,uid FROM lobby_game_completions
 WHERE platform_order_id=? AND included AND win_amount>0 LIMIT 1`, platformOrderID).Scan(&row)
	return row, result.RowsAffected > 0, result.Error
}

func (m *GameModel) ReadReplayOrderForGame(ctx context.Context, platformOrderID int64, gameID string) (ReplayOrder, bool, error) {
	var row ReplayOrder
	result := m.DB.WithContext(ctx).Raw(`SELECT game_id,bet_id,uid FROM lobby_game_completions
 WHERE platform_order_id=? AND game_id=? AND included AND win_amount>0 LIMIT 1`, platformOrderID, gameID).Scan(&row)
	return row, result.RowsAffected > 0, result.Error
}
