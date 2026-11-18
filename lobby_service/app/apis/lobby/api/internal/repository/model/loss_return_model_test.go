package model

import (
	"context"
	"fmt"
	"math"
	"strings"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/config"

	"gorm.io/gorm"
)

func TestLossReturnFormula(t *testing.T) {
	for _, tc := range []struct {
		bets, wins, credits int64
		fee                 int32
		want                int64
	}{
		{100000, 60000, 10000, 1000, 26000},
		{100000, 60000, 0, 1000, 36000},
		{100000, 60000, 10000, 0, 30000},
		{60000, 100000, 50000, 1000, 0},
		{60000, 100000, 0, 1000, 0},
		{100000, 100000, 0, 1000, 0},
		{100000, 100000, 10000, 1000, 0},
		{100000, 60000, 50000, 1000, 0},
		{0, 0, 10000, 1000, 0},
		{1, 0, 0, 1000, 1},
		{144500, 0, 0, 1000, 130050},
		{math.MaxInt64, 0, 0, 0, math.MaxInt64},
		{math.MaxInt64, 0, 0, 10000, 0},
		{math.MaxInt64, math.MaxInt64, 0, 10000, 0},
	} {
		got, e := lossReturnBase(tc.bets, tc.wins, tc.credits, tc.fee)
		if e != nil || got != tc.want {
			t.Fatalf("%+v got %d %v", tc, got, e)
		}
	}
	if _, e := lossReturnBase(100, 0, 0, -1); e == nil {
		t.Fatal("negative fee must fail")
	}
	base, e := lossReturnBase(144500, 0, 0, 1000)
	if e != nil || returnAmount(base, 800) != 10404 {
		t.Fatal("1445 loss with 10% fee and 8% return", base, e)
	}
}

func TestLossReturnRewardSelectionAndImmediatePolicy(t *testing.T) {
	db := vipTestDB(t)
	loc, _ := time.LoadLocation("Asia/Jakarta")
	now := time.Date(2026, 6, 10, 12, 0, 0, 0, loc)
	uid, err := (&UserModel{DB: db}).Create(context.Background(), "", "", strings.Repeat("f", 64), now.AddDate(1, 0, 0))
	if err != nil {
		t.Fatal(err)
	}
	c := config.ReturnConfig{LoserReturnRateBps: 1000, PlatformFeeRateBps: 1000, RewardSources: map[string]bool{"checkin": true}}
	if e := ConfigureReturnRates(db, c, loc, now, true); e != nil {
		t.Fatal(e)
	}
	_, start, end := returnBounds(now, loc, ReturnLoser)
	// Committed wallet entries are sufficient: no synthetic bets or real player funds.
	for i, row := range []struct {
		source  string
		delta   int64
		at      time.Time
		account string
	}{
		{"act_001", 10000, start.Add(time.Hour), "real"},
		{"agt_001", 90000, start.Add(time.Hour), "real"},
		{"act_007", 80000, start.Add(time.Hour), "real"},
		{"act_001", 70000, start.Add(-time.Second), "real"},
		{"act_001", 60000, end, "real"},
	} {
		if e := db.Exec(`INSERT INTO lobby_coin_ledger(uid,order_id,source,delta,balance_before,balance_after,created_at,account_type) VALUES(?,?,?,?,0,?,?,?)`, uid, fmt.Sprintf("loss:%d", i), row.source, row.delta, row.delta, row.at, row.account).Error; e != nil {
			t.Fatal(e)
		}
	}
	credits, e := lossRewardCredits(db, uid, start, end, c.LossConfig())
	if e != nil || credits != 10000 {
		t.Fatal(credits, e)
	}
	next := c
	next.PlatformFeeRateBps = 2000
	next.RewardSources = map[string]bool{"agentCommission": true, "inviteReward": true}
	if e = ConfigureReturnRates(db, next, loc, now, false); e != nil {
		t.Fatal(e)
	}
	old, e := effectiveLossPolicy(db, next, start)
	if e != nil || old.PlatformFeeRateBps != 2000 || !old.RewardSources["agentCommission"] {
		t.Fatal(old, e)
	}
	future, e := effectiveLossPolicy(db, next, end)
	if e != nil || future.PlatformFeeRateBps != 2000 || !future.RewardSources["agentCommission"] {
		t.Fatal(future, e)
	}
	credits, e = lossRewardCredits(db, uid, start, end, future)
	if e != nil || credits != 170000 {
		t.Fatal(credits, e)
	}
	// Publication audit changes roll back with the surrounding transaction.
	e = db.WithContext(context.Background()).Transaction(func(tx *gorm.DB) error {
		if e := ConfigureReturnRates(tx, c, loc, now, false); e != nil {
			return e
		}
		return gorm.ErrInvalidTransaction
	})
	if e == nil {
		t.Fatal("rollback expected")
	}
	var recorded LobbyReturnRateRule
	e = db.Where("kind=? AND effective_from=?", ReturnLoser, now.Format(time.DateOnly)).Take(&recorded).Error
	if e != nil || recorded.PlatformFeeRateBps != 2000 {
		t.Fatal(recorded, e)
	}
}

func TestLossReturnAllCategoriesAndIdempotentClaim(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	loc, _ := time.LoadLocation("Asia/Jakarta")
	now := time.Date(2026, 6, 10, 12, 0, 0, 0, loc)
	token := strings.Repeat("e", 64)
	uid, e := (&UserModel{DB: db}).Create(ctx, "", "", token, now.AddDate(1, 0, 0))
	if e != nil {
		t.Fatal(e)
	}
	_, start, end := returnBounds(now, loc, ReturnLoser)
	index := 0
	for _, category := range config.LossRewardCategories {
		for _, source := range lossRewardSources[category] {
			index++
			if e = db.Exec(`INSERT INTO lobby_coin_ledger(uid,order_id,source,delta,balance_before,balance_after,created_at) VALUES(?,?,?,100,0,100,?)`, uid, fmt.Sprintf("category:%d", index), string(source), start.Add(time.Hour)).Error; e != nil {
				t.Fatal(e)
			}
		}
	}
	for _, category := range config.LossRewardCategories {
		policy := config.LossReturnConfig{RewardSources: map[string]bool{category: true}}
		got, e := lossRewardCredits(db, uid, start, end, policy)
		if e != nil || got != int64(100*len(lossRewardSources[category])) || got == 0 {
			t.Fatalf("%s: %d %v", category, got, e)
		}
		policy.RewardSources[category] = false
		got, e = lossRewardCredits(db, uid, start, end, policy)
		if e != nil || got != 0 {
			t.Fatal(category, got, e)
		}
	}
	// Add 9900 to the 100 check-in credit: total eligible credits are exactly 10000 cents.
	if e = db.Exec(`INSERT INTO lobby_coin_ledger(uid,order_id,source,delta,balance_before,balance_after,created_at) VALUES(?,'extra-checkin','act_001',9900,0,9900,?)`, uid, start.Add(time.Hour)).Error; e != nil {
		t.Fatal(e)
	}
	cfg := config.ReturnConfig{LoserReturnRateBps: 1000, PlatformFeeRateBps: 1000, RewardSources: map[string]bool{"checkin": true}}
	if e = ConfigureReturnRates(db, cfg, loc, now, true); e != nil {
		t.Fatal(e)
	}
	activity := ActivityModel{DB: db, Location: loc}
	for _, event := range []LobbyActivityEvent{
		{EventID: "bets", UID: uid, GameID: "AG1", EventType: EventGameBet, Amount: 100000, OccurredAt: start.Add(2 * time.Hour)},
		{EventID: "payouts", UID: uid, GameID: "AG2", EventType: EventGameWin, Amount: 60000, OccurredAt: start.Add(2 * time.Hour)},
	} {
		if e = activity.RecordEvent(ctx, event); e != nil {
			t.Fatal(e)
		}
	}
	m := ReturnModel{DB: db}
	preview, e := m.ReadReturns(ctx, uid, token, GroupLoser, cfg, loc, now)
	if e != nil || preview.Sections[0].Preview.BaseAmount != 26000 || preview.Sections[0].Preview.Reward != 2600 {
		t.Fatal(preview, e)
	}
	// A newly published request config snapshot changes all unpaid calculations immediately,
	// including explicit zero rates and disabled sources, without waiting for tomorrow.
	immediate := cfg
	immediate.LoserReturnRateBps = 0
	immediate.PlatformFeeRateBps = 2000
	immediate.RewardSources = map[string]bool{}
	unpaid, e := m.ReadReturns(ctx, uid, token, GroupLoser, immediate, loc, now)
	if e != nil || unpaid.Sections[0].Preview.BaseAmount != 32000 || unpaid.Sections[0].Preview.Reward != 0 {
		t.Fatal(unpaid, e)
	}
	tomorrow := now.AddDate(0, 0, 1)
	date := tomorrow.Format(time.DateOnly)
	for range 2 {
		receipt, e := m.ClaimReturns(ctx, uid, token, GroupLoser, date, cfg, loc, tomorrow)
		if e != nil || receipt.Batch.TotalReward != 2600 || len(receipt.Items) != 1 || receipt.Items[0].BaseAmount != 26000 {
			t.Fatal(receipt, e)
		}
	}
	var count int64
	if e = db.Model(&LobbyCoinLedger{}).Where("uid=? AND source='act_005' AND order_id LIKE 'ret_%'", uid).Count(&count).Error; e != nil || count != 1 {
		t.Fatal(count, e)
	}
	var wallet LobbyWalletBalance
	if e = db.Where("uid=?", uid).Take(&wallet).Error; e != nil || wallet.Coins != 2600 {
		t.Fatal(wallet, e)
	}
	// Saved claims keep the paid base even if a later configuration and source selection differ.
	changed := cfg
	changed.PlatformFeeRateBps = 0
	changed.RewardSources = map[string]bool{}
	view, e := m.ReadReturns(ctx, uid, token, GroupLoser, changed, loc, tomorrow)
	if e != nil || view.Total != 0 || view.Sections[0].Claim.BaseAmount != 26000 || view.Sections[0].Claim.Reward != 2600 {
		t.Fatal(view, e)
	}
}
