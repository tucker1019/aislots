package model

import (
	"context"
	"crypto/rand"
	"math"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"apps/pkg/coinsource"
	"apps/pkg/xerr"
	"time"
)

type PlatformLeaderboardView struct {
	UID                                             int64
	PlatformOrderID                                 string
	Nickname                                        string
	AvatarID                                        int32
	GameID, BetID, BetAmount, WinAmount, Multiplier string
	EndedAt                                         time.Time
	Anonymous                                       bool
	RewardStatus                                    string
}

type PlatformRewardReceipt struct { ClaimID string; Amount, Coins int64; Status string }

func (m *GameModel) EnsurePlatformLeaderboardRewards(ctx context.Context, date time.Time, board string, rewards []int64) error {
	if board != "wins" && board != "multiplier" || len(rewards) != 10 { return xerr.ErrInvalid }
	loc := m.Location; if loc == nil { loc = time.UTC }
	day := date.In(loc); start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, loc); end := start.AddDate(0,0,1)
	return m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var count int64
		if err := tx.Table("lobby_platform_leaderboard_rewards").Where("business_date=? AND board=?", start.Format(time.DateOnly), board).Count(&count).Error; err != nil { return err }
		if count == 10 { return nil }
		score := "win_amount::numeric"; if board == "multiplier" { score = "win_amount::numeric/NULLIF(bet_amount,0)" }
		var rows []struct { UID int64; PlatformOrderID string; GameID, BetID string; Anonymous bool }
		q := `SELECT c.uid,c.platform_order_id::text AS platform_order_id,c.game_id,c.bet_id,(NOT c.leaderboard_participating OR c.leaderboard_anonymous) AS anonymous
 FROM (SELECT DISTINCT ON (uid,game_id,bet_id) uid,platform_order_id,game_id,bet_id,bet_amount,win_amount,leaderboard_participating,leaderboard_anonymous,ended_at FROM lobby_game_completions WHERE included AND ended_at>=? AND ended_at<? ORDER BY uid,game_id,bet_id,ended_at DESC) c
 ORDER BY ` + score + ` DESC,c.ended_at ASC,c.bet_id ASC LIMIT 10`
		if err := tx.Raw(q, start.UTC(), end.UTC()).Scan(&rows).Error; err != nil { return err }
		for i, row := range rows { status := "claimable"; amount := rewards[i]; if row.Anonymous { status, amount = "ineligible", 0 }; if err := tx.Exec(`INSERT INTO lobby_platform_leaderboard_rewards(business_date,board,rank,uid,platform_order_id,amount,anonymous,status) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(business_date,board,rank) DO NOTHING`, start.Format(time.DateOnly), board, i+1, row.UID, row.PlatformOrderID, amount, row.Anonymous, status).Error; err != nil { return err } }
		return nil
	})
}

func (m *GameModel) ClaimPlatformLeaderboardReward(ctx context.Context, uid int64, date time.Time, board string, rank int, turnover bool, now time.Time) (*PlatformRewardReceipt, error) {
	if uid <= 0 || (board != "wins" && board != "multiplier") || rank < 1 || rank > 10 { return nil, xerr.ErrInvalid }
	var receipt PlatformRewardReceipt
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var row struct { ClaimID *string; Amount int64; Status string; UID int64; Anonymous bool }
		if err := tx.Clauses(clause.Locking{Strength:"UPDATE"}).Table("lobby_platform_leaderboard_rewards").Select("claim_id,amount,status,uid,anonymous").Where("business_date=? AND board=? AND rank=?", date.Format(time.DateOnly), board, rank).Take(&row).Error; err != nil { return xerr.ErrInvalid }
		if row.UID != uid || row.Anonymous || row.Status == "ineligible" { return xerr.ErrInvalid }
		if row.Status == "claimed" { receipt.ClaimID = valueOrEmpty(row.ClaimID); receipt.Amount = row.Amount; receipt.Status = row.Status; var wallet LobbyWalletBalance; if err:=tx.Where("uid=?",uid).Take(&wallet).Error; err!=nil{return err}; receipt.Coins=wallet.Coins; return nil }
		var wallet LobbyWalletBalance; if err:=tx.Clauses(clause.Locking{Strength:"UPDATE"}).Where("uid=?",uid).Take(&wallet).Error; err!=nil{return err}
		if wallet.Coins > math.MaxInt64-row.Amount { return xerr.ErrBalanceLimit }
		claimID := "lbr_" + rand.Text(); coins := wallet.Coins + row.Amount
		if err:=tx.Create(&LobbyCoinLedger{UID:uid,OrderID:claimID,Source:string(coinsource.SourceLeaderboardReward),Delta:row.Amount,BalanceBefore:wallet.Coins,BalanceAfter:coins}).Error; err!=nil{return err}
		if err:=tx.Model(&wallet).Update("coins",coins).Error; err!=nil{return err}
		if err:=tx.Table("lobby_platform_leaderboard_rewards").Where("business_date=? AND board=? AND rank=?",date.Format(time.DateOnly),board,rank).Updates(map[string]any{"status":"claimed","claim_id":claimID,"claimed_at":now}).Error; err!=nil{return err}
		receipt = PlatformRewardReceipt{ClaimID:claimID,Amount:row.Amount,Coins:coins,Status:"claimed"}; _ = turnover
		return nil
	})
	if err != nil { return nil, err }; return &receipt,nil
}

func valueOrEmpty(v *string) string { if v == nil { return "" }; return *v }

func (m *GameModel) ReadPlatformLeaderboard(ctx context.Context, board, period string, now time.Time) ([]PlatformLeaderboardView, error) {
	if board != "wins" && board != "multiplier" {
		return nil, gorm.ErrInvalidData
	}
	if period != "today" && period != "yesterday" {
		return nil, gorm.ErrInvalidData
	}
	day := now.In(m.Location)
	if period == "yesterday" {
		day = day.AddDate(0, 0, -1)
	}
	start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, m.Location)
	end := start.AddDate(0, 0, 1)
	score := `win_amount::numeric`
	if board == "multiplier" {
		score = `win_amount::numeric/NULLIF(bet_amount,0)`
	}
	q := `SELECT c.uid,c.platform_order_id::text AS platform_order_id,COALESCE(NULLIF(c.nickname,''),u.nickname) AS nickname,c.avatar_id,c.game_id,bet_id,bet_amount::text,win_amount::text,ROUND((win_amount::numeric/NULLIF(bet_amount,0)),2)::text AS multiplier,ended_at,(NOT c.leaderboard_participating OR c.leaderboard_anonymous) AS anonymous FROM (SELECT DISTINCT ON (uid,game_id,bet_id) uid,platform_order_id,leaderboard_nickname AS nickname,leaderboard_participating,leaderboard_anonymous,game_id,bet_id,bet_amount,win_amount,ended_at,(SELECT avatar_id FROM lobby_users u WHERE u.uid=c.uid) avatar_id FROM lobby_game_completions c WHERE included AND ended_at>=? AND ended_at<? ORDER BY uid,game_id,bet_id,ended_at DESC) c JOIN lobby_users u ON u.uid=c.uid ORDER BY ` + score + ` DESC,ended_at ASC,bet_id ASC LIMIT 10`
	var rows []PlatformLeaderboardView
	err := m.DB.WithContext(ctx).Raw(q, start.UTC(), end.UTC()).Scan(&rows).Error
	return rows, err
}

func (m *GameModel) ReadPlatformRewardStatuses(ctx context.Context, date time.Time, board string) (map[int]string, error) {
	rows := []struct{ Rank int; Status string }{}
	if err := m.DB.WithContext(ctx).Table("lobby_platform_leaderboard_rewards").Select("rank,status").Where("business_date=? AND board=?", date.Format(time.DateOnly), board).Scan(&rows).Error; err != nil { return nil, err }
	out := map[int]string{}; for _, row := range rows { out[row.Rank] = row.Status }; return out,nil
}
