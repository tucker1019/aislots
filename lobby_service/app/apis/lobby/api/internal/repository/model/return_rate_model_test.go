package model

import (
	"apps/app/apis/lobby/api/internal/config"
	"context"
	"errors"
	"gorm.io/gorm"
	"testing"
	"time"
)

func TestReturnRatesEffectivePeriods(t *testing.T) {
	db := vipTestDB(t)
	loc, _ := time.LoadLocation("Asia/Jakarta")
	now := time.Date(2026, 6, 10, 23, 59, 0, 0, loc)
	old := config.ReturnConfig{DailyRateBps: 100, WeeklyRateBps: 200, MonthlyRateBps: 300, LoserReturnRateBps: 400}
	next := config.ReturnConfig{DailyRateBps: 1000, WeeklyRateBps: 2000, MonthlyRateBps: 3000, LoserReturnRateBps: 4000}
	if e := ConfigureReturnRates(db, old, loc, now, true); e != nil {
		t.Fatal(e)
	}
	if e := ConfigureReturnRates(db, next, loc, now, false); e != nil {
		t.Fatal(e)
	}
	for _, kind := range []string{ReturnDaily, ReturnWeekly, ReturnMonthly, ReturnLoser} {
		previous, current, end := returnBounds(now, loc, kind)
		for _, start := range []time.Time{previous, current} {
			r, e := effectiveReturnRate(db, next, kind, start)
			if e != nil || r != rateFor(old, kind) {
				t.Fatalf("%s historical/current rate=%d %v", kind, r, e)
			}
		}
		r, e := effectiveReturnRate(db, old, kind, end)
		if e != nil || r != rateFor(next, kind) {
			t.Fatalf("%s next rate=%d %v", kind, r, e)
		}
		future := end.AddDate(0, 2, 0)
		r, e = effectiveReturnRate(db, old, kind, future)
		if e != nil || r != rateFor(next, kind) {
			t.Fatalf("%s carried rate=%d %v", kind, r, e)
		}
	}
	// Repeated seed must preserve historical baseline, and repeated publication
	// before a boundary replaces only the scheduled rate for that boundary.
	if e := ConfigureReturnRates(db, next, loc, now, true); e != nil {
		t.Fatal(e)
	}
	replacement := config.ReturnConfig{DailyRateBps: 1100, WeeklyRateBps: 2200, MonthlyRateBps: 3300, LoserReturnRateBps: 4400}
	if e := ConfigureReturnRates(db, replacement, loc, now.Add(time.Second), false); e != nil {
		t.Fatal(e)
	}
	var n int64
	db.Table("lobby_return_rate_rules").Count(&n)
	if n != 8 {
		t.Fatalf("duplicate scheduled rules %d", n)
	}
	for _, kind := range []string{ReturnDaily, ReturnWeekly, ReturnMonthly, ReturnLoser} {
		_, current, end := returnBounds(now, loc, kind)
		r, e := effectiveReturnRate(db, next, kind, current)
		if e != nil || r != rateFor(old, kind) {
			t.Fatalf("%s baseline changed %d %v", kind, r, e)
		}
		r, e = effectiveReturnRate(db, next, kind, end)
		if e != nil || r != rateFor(replacement, kind) {
			t.Fatalf("%s pending replacement %d %v", kind, r, e)
		}
	}
	// A later publication retains the now-effective rule and schedules another boundary.
	later := now.AddDate(0, 2, 0)
	if e := ConfigureReturnRates(db, old, loc, later, false); e != nil {
		t.Fatal(e)
	}
	for _, kind := range []string{ReturnDaily, ReturnWeekly, ReturnMonthly, ReturnLoser} {
		_, _, firstEnd := returnBounds(now, loc, kind)
		r, e := effectiveReturnRate(db, next, kind, firstEnd)
		if e != nil || r != rateFor(replacement, kind) {
			t.Fatalf("%s rollback rewrote history %d %v", kind, r, e)
		}
	}
}

func TestReturnRateScheduleTransactionRollback(t *testing.T) {
	db := vipTestDB(t)
	c := config.ReturnConfig{DailyRateBps: 100, WeeklyRateBps: 200, MonthlyRateBps: 300, LoserReturnRateBps: 400}
	now := time.Date(2026, 6, 10, 12, 0, 0, 0, time.UTC)
	if e := ConfigureReturnRates(db, c, time.UTC, now, true); e != nil {
		t.Fatal(e)
	}
	rollback := errors.New("audit failed")
	e := db.Transaction(func(tx *gorm.DB) error {
		if e := ConfigureReturnRates(tx, config.ReturnConfig{DailyRateBps: 9000}, time.UTC, now, false); e != nil {
			return e
		}
		return rollback
	})
	if !errors.Is(e, rollback) {
		t.Fatal(e)
	}
	var n int64
	db.Table("lobby_return_rate_rules").Count(&n)
	if n != 4 {
		t.Fatalf("schedule escaped enclosing transaction %d", n)
	}
	invalid := c
	invalid.MonthlyRateBps = 10001
	if e = ConfigureReturnRates(db, invalid, time.UTC, now, false); e == nil {
		t.Fatal("invalid rate accepted")
	}
	db.Table("lobby_return_rate_rules").Count(&n)
	if n != 4 {
		t.Fatalf("partial schedule on validation failure %d", n)
	}
}

func TestReturnReadsUsePeriodRulesAndFallback(t *testing.T) {
	db := vipTestDB(t)
	loc := time.UTC
	now := time.Date(2026, 6, 10, 12, 0, 0, 0, loc)
	ctx := context.Background()
	uid, e := (&UserModel{DB: db}).Create(ctx, "", "", "return-rate-test", now.AddDate(1, 0, 0))
	if e != nil {
		t.Fatal(e)
	}
	for day := time.Date(2026, 5, 1, 0, 0, 0, 0, loc); !day.After(now); day = day.AddDate(0, 0, 1) {
		if e = db.Create(&LobbyActivityDaily{UID: uid, BusinessDate: day.Format(time.DateOnly), ValidBet: 10000, BetAmount: 20000, WinAmount: 10000}).Error; e != nil {
			t.Fatal(e)
		}
	}
	old := config.ReturnConfig{DailyRateBps: 100, WeeklyRateBps: 200, MonthlyRateBps: 300, LoserReturnRateBps: 400}
	changed := config.ReturnConfig{DailyRateBps: 1000, WeeklyRateBps: 2000, MonthlyRateBps: 3000, LoserReturnRateBps: 4000}
	for _, group := range []string{GroupRebate, GroupLoser} {
		v, e := readReturns(db, uid, group, old, loc, now)
		if e != nil {
			t.Fatal(e)
		}
		for _, section := range v.Sections {
			if section.Claim.RateBps != rateFor(old, section.Claim.Kind) {
				t.Fatal("uninitialized rate fallback")
			}
		}
	}
	if e = ConfigureReturnRates(db, old, loc, now, true); e != nil {
		t.Fatal(e)
	}
	if e = ConfigureReturnRates(db, changed, loc, now, false); e != nil {
		t.Fatal(e)
	}
	for _, group := range []string{GroupRebate, GroupLoser} {
		v, e := readReturns(db, uid, group, changed, loc, now)
		if e != nil {
			t.Fatal(e)
		}
		for _, section := range v.Sections {
			if section.Claim.RateBps != rateFor(old, section.Claim.Kind) || section.Preview.RateBps != rateFor(old, section.Preview.Kind) {
				t.Fatalf("current configuration recomputed %s", section.Claim.Kind)
			}
		}
	}
	tomorrow := now.AddDate(0, 0, 1)
	v, e := readReturns(db, uid, GroupRebate, changed, loc, tomorrow)
	if e != nil {
		t.Fatal(e)
	}
	if v.Sections[0].Claim.RateBps != 100 || v.Sections[0].Claim.Reward != 100 || v.Sections[0].Preview.RateBps != 1000 {
		t.Fatalf("daily transition %+v", v.Sections[0])
	}
}
