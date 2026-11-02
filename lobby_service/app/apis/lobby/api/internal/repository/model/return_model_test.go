package model

import (
	"context"
	"errors"
	"fmt"
	"math"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	migrations "apps/deploy/migration"
	"apps/pkg/xerr"

	"github.com/jackc/pgx/v5"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestReturnCalendarAndRounding(t *testing.T) {
	loc, _ := time.LoadLocation("Asia/Jakarta")
	for _, tc := range []struct{ date, kind, start, current, end string }{
		{"2026-06-01", ReturnDaily, "2026-05-31", "2026-06-01", "2026-06-02"},
		{"2026-06-01", ReturnWeekly, "2026-05-25", "2026-06-01", "2026-06-08"},
		{"2026-06-07", ReturnWeekly, "2026-05-25", "2026-06-01", "2026-06-08"},
		{"2026-06-01", ReturnMonthly, "2026-05-01", "2026-06-01", "2026-07-01"},
		{"2024-03-01", ReturnMonthly, "2024-02-01", "2024-03-01", "2024-04-01"},
		{"2027-01-01", ReturnMonthly, "2026-12-01", "2027-01-01", "2027-02-01"},
		{"2027-01-04", ReturnWeekly, "2026-12-28", "2027-01-04", "2027-01-11"},
	} {
		now, _ := time.ParseInLocation(time.DateOnly, tc.date, loc)
		a, b, c := returnBounds(now, loc, tc.kind)
		if a.Format(time.DateOnly) != tc.start || b.Format(time.DateOnly) != tc.current || c.Format(time.DateOnly) != tc.end {
			t.Fatal(tc, a, b, c)
		}
	}
	if returnAmount(124, 80) != 0 || returnAmount(125, 80) != 1 || returnAmount(math.MaxInt64, 10000) != math.MaxInt64 || returnAmount(20000, 1000) != 2000 {
		t.Fatal("rounding/overflow")
	}
}

func TestReturnsPostgres(t *testing.T) {
	url := os.Getenv("LOBBY_INTEGRATION_DATABASE_URL")
	if url == "" {
		t.Skip("set LOBBY_INTEGRATION_DATABASE_URL")
	}
	parsed, err := pgx.ParseConfig(url)
	if err != nil || parsed.Database != "aislots_lobby" {
		t.Fatal("dedicated lobby database required")
	}
	db, err := gorm.Open(postgres.Open(url), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()
	if err = db.Exec(migrations.Schema).Error; err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	loc, _ := time.LoadLocation("Asia/Jakarta")
	now := time.Date(2026, 6, 1, 12, 0, 0, 0, loc)
	token := strings.Repeat("f", 64)
	uid, err := (&UserModel{DB: db}).Create(ctx, "", "", token, now.AddDate(2, 0, 0))
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		for _, table := range []any{&LobbyCoinLedger{}, &LobbyReturnClaim{}, &LobbyReturnBatch{}, &LobbyActivityEvent{}, &LobbyActivityDaily{}, &LobbySession{}, &LobbyWalletBalance{}, &LobbyUser{}} {
			if e := db.Where("uid = ?", uid).Delete(table).Error; e != nil {
				t.Error(e)
			}
		}
	}()
	m := &ReturnModel{DB: db}
	activity := &ActivityModel{DB: db, Location: loc}
	cfg := config.ReturnConfig{DailyRateBps: 80, WeeklyRateBps: 10, MonthlyRateBps: 10, LoserReturnRateBps: 1000}
	date := now.Format(time.DateOnly)
	event := func(suffix, kind, day string, amount int64, valid *int64) {
		t.Helper()
		at, _ := time.ParseInLocation(time.DateOnly, day, loc)
		e := LobbyActivityEvent{EventID: fmt.Sprintf("return-test:%d:%s", uid, suffix), UID: uid, GameID: "AG1", EventType: kind, Amount: amount, ValidBetAmount: valid, OccurredAt: at.Add(12 * time.Hour)}
		if er := activity.RecordEvent(ctx, e); er != nil {
			t.Fatal(er)
		}
		if er := activity.RecordEvent(ctx, e); er != nil {
			t.Fatal("retry", er)
		}
	}
	event("old", EventGameBet, "2026-05-01", 400000, nil)
	event("week", EventGameBet, "2026-05-27", 200000, nil)
	event("yesterday", EventGameBet, "2026-05-31", 100000, nil)
	event("win", EventGameWin, "2026-05-31", 80000, nil)
	valid := int64(150000)
	event("today", EventGameBet, date, 200000, &valid)
	event("today-win", EventGameWin, date, 250000, nil)
	// Invalid or conflicting valid turnover cannot silently change statistics.
	bad := int64(101)
	if er := activity.RecordEvent(ctx, LobbyActivityEvent{EventID: "invalid", UID: uid, GameID: "AG1", EventType: EventGameBet, Amount: 100, ValidBetAmount: &bad, OccurredAt: now}); !errors.Is(er, xerr.ErrInvalid) {
		t.Fatal(er)
	}
	conflict := int64(149999)
	at, _ := time.ParseInLocation(time.DateOnly, date, loc)
	if er := activity.RecordEvent(ctx, LobbyActivityEvent{EventID: fmt.Sprintf("return-test:%d:today", uid), UID: uid, GameID: "AG1", EventType: EventGameBet, Amount: 200000, ValidBetAmount: &conflict, OccurredAt: at.Add(12 * time.Hour)}); !errors.Is(er, xerr.ErrActivityConflict) {
		t.Fatal(er)
	}
	if _, er := m.ReadReturns(ctx, uid, "bad", GroupRebate, cfg, loc, now); !errors.Is(er, xerr.ErrSession) {
		t.Fatal(er)
	}
	v, err := m.ReadReturns(ctx, uid, token, GroupRebate, cfg, loc, now)
	if err != nil || v.Total != 1800 || v.Sections[0].Claim.Reward != 800 || v.Sections[1].Claim.Reward != 300 || v.Sections[2].Claim.Reward != 700 {
		t.Fatal(v, err)
	}
	if v.Sections[0].Preview.Reward != 1200 || v.Sections[0].Preview.BetAmount != 200000 || v.Sections[0].Preview.ValidBet != 150000 || v.Sections[0].Preview.Status != "preview" {
		t.Fatal(v.Sections[0].Preview)
	}
	loser, err := m.ReadReturns(ctx, uid, token, GroupLoser, cfg, loc, now)
	if err != nil || loser.Total != 2000 || loser.Sections[0].Claim.BaseAmount != 20000 || loser.Sections[0].Preview.Reward != 0 {
		t.Fatal(loser, err)
	}
	if _, er := m.ClaimReturns(ctx, uid, "bad", GroupRebate, date, cfg, loc, now); !errors.Is(er, xerr.ErrSession) {
		t.Fatal(er)
	}
	// Insufficient headroom for the whole batch must not partially post daily/weekly/monthly.
	db.Model(&LobbyWalletBalance{}).Where("uid = ?", uid).Update("coins", int64(math.MaxInt64-1000))
	if _, er := m.ClaimReturns(ctx, uid, token, GroupRebate, date, cfg, loc, now); !errors.Is(er, xerr.ErrBalanceLimit) {
		t.Fatal(er)
	}
	var count int64
	db.Model(&LobbyReturnBatch{}).Where("uid = ?", uid).Count(&count)
	if count != 0 {
		t.Fatal(count)
	}
	db.Model(&LobbyWalletBalance{}).Where("uid = ?", uid).Update("coins", int64(0))
	// Inject a failure on the final monthly ledger insert: earlier inserts must roll back.
	callbackName := "return_test_fail_monthly"
	if er := db.Callback().Create().Before("gorm:create").Register(callbackName, func(tx *gorm.DB) {
		if entry, ok := tx.Statement.Dest.(*LobbyCoinLedger); ok && entry.UID == uid && entry.Source == "act_004" {
			tx.AddError(errors.New("test monthly posting failure"))
		}
	}); er != nil {
		t.Fatal(er)
	}
	_, injected := m.ClaimReturns(ctx, uid, token, GroupRebate, date, cfg, loc, now)
	if er := db.Callback().Create().Remove(callbackName); er != nil {
		t.Fatal(er)
	}
	if injected == nil {
		t.Fatal("expected posting failure")
	}
	db.Model(&LobbyReturnBatch{}).Where("uid = ?", uid).Count(&count)
	if count != 0 {
		t.Fatal("partial batch persisted", count)
	}
	db.Model(&LobbyReturnClaim{}).Where("uid = ?", uid).Count(&count)
	if count != 0 {
		t.Fatal("partial rewards persisted", count)
	}
	db.Model(&LobbyCoinLedger{}).Where("uid = ?", uid).Count(&count)
	if count != 0 {
		t.Fatal("partial ledger persisted", count)
	}
	var unchanged LobbyWalletBalance
	db.Where("uid = ?", uid).Take(&unchanged)
	if unchanged.Coins != 0 {
		t.Fatal(unchanged)
	}
	var wg sync.WaitGroup
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r, e := m.ClaimReturns(ctx, uid, token, GroupRebate, date, cfg, loc, now)
			if e != nil || r.Batch.TotalReward != 1800 || len(r.Items) != 3 {
				t.Error(r, e)
			}
		}()
	}
	wg.Wait()
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r, e := m.ClaimReturns(ctx, uid, token, GroupLoser, date, cfg, loc, now)
			if e != nil || r.Batch.TotalReward != 2000 || len(r.Items) != 1 {
				t.Error(r, e)
			}
		}()
	}
	wg.Wait()
	var wallet LobbyWalletBalance
	db.Where("uid = ?", uid).Take(&wallet)
	if wallet.Coins != 3800 {
		t.Fatal("double credit", wallet)
	}
	var entries []LobbyCoinLedger
	db.Where("uid = ?", uid).Find(&entries)
	if len(entries) != 4 {
		t.Fatal(entries)
	}
	v, err = m.ReadReturns(ctx, uid, token, GroupRebate, cfg, loc, now)
	if err != nil || v.Total != 0 {
		t.Fatal(v, err)
	}
	for _, s := range v.Sections {
		if s.Claim.Status != "claimed" {
			t.Fatal(s)
		}
	}
	// Claimed data and rate remain immutable if new late data arrives or rates change.
	event("late", EventGameBet, "2026-05-31", 100000, nil)
	changed := cfg
	changed.DailyRateBps = 1000
	v, err = m.ReadReturns(ctx, uid, token, GroupRebate, changed, loc, now)
	if err != nil || v.Sections[0].Claim.Reward != 800 || v.Sections[0].Claim.ValidBet != 100000 {
		t.Fatal(v, err)
	}
	tomorrow := now.AddDate(0, 0, 1)
	v, err = m.ReadReturns(ctx, uid, token, GroupRebate, cfg, loc, tomorrow)
	if err != nil || v.Total != 1200 || v.Sections[0].Claim.PeriodStart != date || v.Sections[0].Claim.Reward != 1200 {
		t.Fatal(v, err)
	}
	if v.Sections[1].Claim.Status != "claimed" || v.Sections[2].Claim.Status != "claimed" {
		t.Fatal(v)
	}
	replay, err := m.ClaimReturns(ctx, uid, token, GroupRebate, date, cfg, loc, tomorrow)
	if err != nil || replay.Batch.TotalReward != 1800 {
		t.Fatal(replay, err)
	}
	// This user's fresh daily reward is available; old periods cannot be paid again.
	r, err := m.ClaimReturns(ctx, uid, token, GroupRebate, tomorrow.Format(time.DateOnly), cfg, loc, tomorrow)
	if err != nil || r.Batch.TotalReward != 1200 || len(r.Items) != 1 {
		t.Fatal(r, err)
	}
	if _, er := m.ClaimReturns(ctx, uid, token, GroupLoser, tomorrow.Format(time.DateOnly), cfg, loc, tomorrow); !errors.Is(er, xerr.ErrReturnEmpty) {
		t.Fatal(er)
	}
	// An unclaimed date is expired and cannot be backdated by the client.
	if _, er := m.ClaimReturns(ctx, uid, token, GroupLoser, "2026-05-31", cfg, loc, tomorrow); !errors.Is(er, xerr.ErrReturnDate) {
		t.Fatal(er)
	}
	// A future Tuesday read without claim rows shows old weekly/monthly rewards as expired.
	if er := db.Where("uid = ?", uid).Delete(&LobbyCoinLedger{}).Error; er != nil {
		t.Fatal(er)
	}
	db.Where("uid = ?", uid).Delete(&LobbyReturnClaim{})
	db.Where("uid = ?", uid).Delete(&LobbyReturnBatch{})
	v, err = m.ReadReturns(ctx, uid, token, GroupRebate, cfg, loc, tomorrow)
	if err != nil || v.Sections[1].Claim.Status != "expired" || v.Sections[2].Claim.Status != "expired" || v.Total != 1200 {
		t.Fatal(v, err)
	}
}
