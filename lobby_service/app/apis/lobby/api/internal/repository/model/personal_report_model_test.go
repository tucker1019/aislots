package model

import (
	"context"
	"fmt"
	"testing"
	"time"
)

func TestPersonalReportPrincipalRewardsAndBoundaries(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	users := &UserModel{DB: db}
	uid, e := users.Create(ctx, "", "", "report-a", time.Now().Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	other, e := users.Create(ctx, "", "", "report-b", time.Now().Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	loc, _ := time.LoadLocation("Asia/Jakarta")
	now := time.Date(2026, 11, 3, 12, 0, 0, 0, loc)
	from, to := reportBounds("today", now, loc)
	entries := []struct {
		source string
		value  int64
	}{{"rch_001", 10000}, {"rch_002", 200}, {"rch_003", -200}, {"act_001", 10}, {"vip_001", 30}, {"vip_002", 40}, {"vip_003", 50}, {"act_005", 60}, {"act_002", 100}, {"act_003", 200}, {"act_004", 300}, {"act_006", 70}, {"act_007", 80}, {"game_001", -1000}, {"game_002", 500}}
	add := func(owner int64, at time.Time, id, source string, value int64) {
		t.Helper()
		if err := db.Create(&LobbyCoinLedger{UID: owner, OrderID: id, Source: source, Delta: value, BalanceBefore: 10000, BalanceAfter: 10000 + value, CreatedAt: at}).Error; err != nil {
			t.Fatal(err)
		}
	}
	for i, row := range entries {
		add(uid, from, fmt.Sprint(i), row.source, row.value)
	}
	add(uid, from.Add(-time.Microsecond), "before", "rch_001", 999)
	add(uid, to, "after", "game_002", 999)
	add(other, from, "foreign", "rch_001", 999)
	valid := int64(500)
	if e = db.Create(&LobbyActivityEvent{EventID: "report-event", UID: uid, EventType: EventGameBet, GameID: "AG1", Amount: 1000, ValidBetAmount: &valid, OccurredAt: from, BusinessDate: "2026-11-03"}).Error; e != nil {
		t.Fatal(e)
	}
	for _, extra := range []LobbyActivityEvent{
		{EventID: "report-other", UID: other, EventType: EventGameBet, GameID: "AG1", Amount: 1000, ValidBetAmount: &valid, OccurredAt: from, BusinessDate: "2026-11-03"},
		{EventID: "report-next-day", UID: uid, EventType: EventGameBet, GameID: "AG1", Amount: 1000, ValidBetAmount: &valid, OccurredAt: to, BusinessDate: "2026-11-04"},
	} {
		if err := db.Create(&extra).Error; err != nil {
			t.Fatal(err)
		}
	}
	report, e := (&GameModel{DB: db, Location: loc}).PersonalReport(ctx, uid, "today", now)
	if e != nil {
		t.Fatal(e)
	}
	for key, want := range map[string]int64{"recharge": 10000, "betAmount": 1000, "validBet": 500, "gameProfit": -500, "rebate": 600, "checkin": 10, "vipUpgrade": 30, "vipWeekly": 40, "vipMonthly": 50, "loserReturn": 60, "rechargeBonus": 200, "newbieReward": 70, "inviteReward": 80, "netProfit": 640} {
		if report.Amounts[key] != want {
			t.Fatalf("%s = %d, want %d", key, report.Amounts[key], want)
		}
	}
	empty, e := (&GameModel{DB: db, Location: loc}).PersonalReport(ctx, other, "yesterday", now)
	if e != nil || empty.Amounts["netProfit"] != 0 {
		t.Fatal(empty, e)
	}
}

func TestReportCalendarWeeksAndDST(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Jakarta")
	now := time.Date(2026, 1, 1, 1, 0, 0, 0, loc)
	for period, want := range map[string]string{"today": "2026-01-01", "yesterday": "2025-12-31", "this_week": "2025-12-29", "last_week": "2025-12-22"} {
		start, _ := reportBounds(period, now, loc)
		if start.Format(time.DateOnly) != want {
			t.Fatal(period, start)
		}
	}
	ny, _ := time.LoadLocation("America/New_York")
	start, end := reportBounds("today", time.Date(2026, 3, 8, 12, 0, 0, 0, ny), ny)
	if end.Sub(start) != 23*time.Hour {
		t.Fatal(start, end)
	}
}
