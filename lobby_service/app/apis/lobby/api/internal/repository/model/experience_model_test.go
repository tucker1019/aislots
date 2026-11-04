package model

import (
	"context"
	"testing"
	"time"
)

func TestExperienceAccountIsolationAndRecovery(t *testing.T) {
	db := vipTestDB(t)
	m := ExperienceModel{DB: db}
	ctx := context.Background()
	now := time.Now().UTC()
	a, e := m.Prepare(ctx, false, 10, 1, 100000, now)
	if e != nil || a != nil {
		t.Fatalf("disabled: %v %v", a, e)
	}
	a, e = m.Prepare(ctx, true, 10, 1, 100000, now)
	if e != nil {
		t.Fatal(e)
	}
	retry, e := m.Prepare(ctx, false, 500, 10, 999999, now)
	if e != nil || retry.RequestID != a.RequestID || retry.Bet != 10 {
		t.Fatalf("pending changed: %v %v", retry, e)
	}
	var user LobbyUser
	if e = db.Where("uid=?", a.UID).Take(&user).Error; e != nil || user.AccountType != "experience" {
		t.Fatal(user, e)
	}
	game := GameModel{DB: db, Location: time.UTC}
	_, e = game.Settle(ctx, &LobbyGameSettlement{UID: a.UID, RequestID: "experience_test", GameID: "AG1", BetID: "test", Debit: 200, Credit: 500}, now)
	if e != nil {
		t.Fatal(e)
	}
	if _, e = game.CompleteGame(ctx, GameCompletion{UID: a.UID, GameID: "AG1", BetID: "test", Sequence: 1, BetAmount: 200, WinAmount: 500, StartedAt: now, EndedAt: now}); e != nil {
		t.Fatal(e)
	}
	ranks, _, e := game.ReadLeaderboard(ctx, "AG1", "wins", "today", now)
	if e != nil || len(ranks) != 1 || !ranks[0].ExperienceAccount {
		t.Fatal("rank classification", ranks, e)
	}
	rtp, e := game.ReadRTP(ctx, "AG1", 60, now.Add(time.Second))
	if e != nil || rtp.Rounds != 0 {
		t.Fatal("experience leaked into real RTP", rtp, e)
	}
	var n int64
	for _, table := range []string{"lobby_activity_events", "lobby_activity_daily", "lobby_agent_queue", "lobby_vip_states", "lobby_recharge_orders"} {
		if e = db.Table(table).Count(&n).Error; e != nil || n != 0 {
			t.Fatalf("%s leaked: %d %v", table, n, e)
		}
	}
	if e = db.Table("lobby_experience_events").Count(&n).Error; e != nil || n != 2 {
		t.Fatalf("events: %d %v", n, e)
	}
	var row struct{ AccountType string }
	if e = db.Table("lobby_game_settlements").Where("request_id=?", "experience_test").Take(&row).Error; e != nil || row.AccountType != "experience" {
		t.Fatal(row, e)
	}
	var ledgerCount int64
	db.Table("lobby_coin_ledger").Where("source='exp_001'").Count(&ledgerCount)
	if ledgerCount != 1 {
		t.Fatal("funding duplicated")
	}
	if e = m.Finish(ctx, a.RequestID, "test", time.Hour); e != nil {
		t.Fatal(e)
	}
	a, e = m.Prepare(ctx, true, 10, 1, 100000, now)
	if e != nil || a != nil {
		t.Fatalf("ignored interval: %v %v", a, e)
	}
	if e = db.Model(&user).Update("account_type", "real").Error; e == nil {
		t.Fatal("classification mutated")
	}
	var stats struct {
		AccountType string
		BetAmount   int64
	}
	if e = db.Table("lobby_bet_statistics_by_account_type").Take(&stats).Error; e != nil || stats.AccountType != "experience" || stats.BetAmount != 200 {
		t.Fatal(stats, e)
	}
}
