package model

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math"
	"net/url"
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

// Use an isolated schema so deterministic future payroll never touches real lobby accounts.
func vipTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("LOBBY_INTEGRATION_DATABASE_URL")
	if dsn == "" {
		t.Skip("set LOBBY_INTEGRATION_DATABASE_URL")
	}
	parsed, err := pgx.ParseConfig(dsn)
	if err != nil || parsed.Database != "aislots_lobby" {
		t.Fatal("dedicated lobby DB required")
	}
	base, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	schema := "vip_test_" + strings.ToLower(rand.Text())
	if err = base.Exec("CREATE SCHEMA " + schema).Error; err != nil {
		t.Fatal(err)
	}
	u, err := url.Parse(dsn)
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	q.Set("search_path", schema)
	u.RawQuery = q.Encode()
	db, err := gorm.Open(postgres.Open(u.String()), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		s, _ := db.DB()
		_ = s.Close()
		_ = base.Exec("DROP SCHEMA " + schema + " CASCADE").Error
		b, _ := base.DB()
		_ = b.Close()
	})
	if err = db.Exec(migrations.Schema).Error; err != nil {
		t.Fatal(err)
	}
	return db
}

func vipTestConfig() config.VIPConfig {
	return config.VIPConfig{Version: "test", IdleDays: 30, ProtectionDays: 15, Levels: []config.VIPLevel{
		{Level: 0},
		{Level: 1, UpgradeBet: 100, UpgradeReward: 2, KeepBet: 100, KeepRecharge: 100, WeeklyReward: 30, MonthlyReward: 40, WeeklyBet: 100, WeeklyRecharge: 100, MonthlyBet: 100, MonthlyRecharge: 100},
		{Level: 2, UpgradeBet: 1000, UpgradeReward: 8, KeepBet: 100, KeepRecharge: 100, WeeklyReward: 60, MonthlyReward: 80, WeeklyBet: 100, WeeklyRecharge: 100, MonthlyBet: 100, MonthlyRecharge: 100},
		{Level: 3, UpgradeBet: 5000, UpgradeReward: 18, KeepBet: 100, KeepRecharge: 100, WeeklyReward: 90, MonthlyReward: 120, WeeklyBet: 100, WeeklyRecharge: 100, MonthlyBet: 100, MonthlyRecharge: 100},
		{Level: 4, UpgradeBet: 10000, UpgradeReward: 28, KeepBet: 100, KeepRecharge: 100, WeeklyReward: 120, MonthlyReward: 160},
		{Level: 5, UpgradeBet: 50000, UpgradeReward: 38, KeepBet: 100, KeepRecharge: 100, WeeklyReward: 150, MonthlyReward: 200},
	}}
}

func TestVIPPostgres(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	loc, _ := time.LoadLocation("Asia/Jakarta")
	base := time.Date(2026, 5, 25, 12, 0, 0, 0, loc)
	newUser := func(t *testing.T, c config.VIPConfig) (int64, string, *VIPModel, *ActivityModel, *time.Time) {
		t.Helper()
		now := base
		token := rand.Text() + rand.Text()
		uid, err := (&UserModel{DB: db}).Create(ctx, "", "", token, base.AddDate(3, 0, 0))
		if err != nil {
			t.Fatal(err)
		}
		engine := &VIPModel{DB: db, Config: c, Location: loc, Now: func() time.Time { return now }}
		if _, err = engine.ReadVIP(ctx, uid, token, now); err != nil {
			t.Fatal(err)
		}
		return uid, token, engine, &ActivityModel{DB: db, Location: loc, VIP: engine}, &now
	}
	record := func(t *testing.T, a *ActivityModel, uid int64, kind string, amount int64, at time.Time) {
		t.Helper()
		e := LobbyActivityEvent{EventID: rand.Text(), UID: uid, GameID: "AG1", EventType: kind, Amount: amount, OccurredAt: at}
		if err := a.RecordEvent(ctx, e); err != nil {
			t.Fatal(err)
		}
		if err := a.RecordEvent(ctx, e); err != nil {
			t.Fatal("duplicate", err)
		}
	}
	t.Run("progress_protection_demotion_and_reward_history", func(t *testing.T) {
		uid, token, m, a, now := newUser(t, vipTestConfig())
		record(t, a, uid, EventGameBet, 105, *now)
		v, err := m.ReadVIP(ctx, uid, token, *now)
		if err != nil || v.State.Level != 1 || v.State.UpgradeBet != 5 {
			t.Fatal(v, err)
		}
		record(t, a, uid, EventGameBet, 5995, *now)
		v, err = m.ReadVIP(ctx, uid, token, *now)
		if err != nil || v.State.Level != 3 || v.UpgradeTotal != 28 || len(v.Upgrades) != 3 {
			t.Fatal(v, err)
		}
		record(t, a, uid, EventGameBet, 15000, *now)
		v, err = m.ReadVIP(ctx, uid, token, *now)
		if err != nil || v.State.Level != 4 || v.State.UpgradeBet != 5000 {
			t.Fatal(v, err)
		}
		*now = base.Add(30 * 24 * time.Hour)
		if err = m.TickVIP(ctx, *now); err != nil {
			t.Fatal(err)
		}
		v, err = m.ReadVIP(ctx, uid, token, *now)
		if err != nil || v.State.ProtectionEnd == nil || v.State.UpgradeBet != 0 || v.State.UpgradeRecharge != 0 {
			t.Fatal(v, err)
		}
		end := *v.State.ProtectionEnd
		record(t, a, uid, EventGameBet, 200, *now)
		v, _ = m.ReadVIP(ctx, uid, token, *now)
		if v.State.UpgradeBet != 0 || v.State.ProtectionBet != 200 || !v.State.ProtectionEnd.Equal(end) {
			t.Fatal(v.State)
		}
		// Earlier excess and both task targets are included when the task completes.
		record(t, a, uid, EventRechargeSuccess, 150, *now)
		v, _ = m.ReadVIP(ctx, uid, token, *now)
		if v.State.ProtectionEnd != nil || v.State.UpgradeBet != 200 || v.State.UpgradeRecharge != 150 {
			t.Fatal(v.State)
		}
		*now = now.Add(30 * 24 * time.Hour)
		if err = m.TickVIP(ctx, *now); err != nil {
			t.Fatal(err)
		}
		record(t, a, uid, EventRechargeSuccess, 100, *now)
		record(t, a, uid, EventGameBet, 500, *now)
		v, _ = m.ReadVIP(ctx, uid, token, *now)
		if v.State.ProtectionEnd != nil || v.State.UpgradeBet != 500 || v.State.UpgradeRecharge != 100 {
			t.Fatal(v.State)
		}
		// Exactly at deadline: demotion occurs first, then fresh betting starts at the lower level.
		*now = now.Add(45 * 24 * time.Hour)
		record(t, a, uid, EventGameBet, 100, *now)
		v, _ = m.ReadVIP(ctx, uid, token, *now)
		if v.State.Level != 3 || v.State.UpgradeBet != 100 || v.State.HighestLevel != 4 {
			t.Fatal(v.State)
		}
		record(t, a, uid, EventGameBet, 9900, *now)
		v, _ = m.ReadVIP(ctx, uid, token, *now)
		if v.State.Level != 4 || v.UpgradeTotal != 56 || len(v.Upgrades) != 4 {
			t.Fatal(v)
		}
		var wg sync.WaitGroup
		date := now.In(loc).Format(time.DateOnly)
		for i := 0; i < 12; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				r, e := m.ClaimVIP(ctx, uid, token, "upgrade", "same-request", date, v.Upgrades[0].RewardID, *now)
				if e != nil || r.Batch.TotalReward != v.Upgrades[0].Amount || len(r.Items) != 1 {
					t.Error(r, e)
				}
			}()
		}
		wg.Wait()
		if _, e := m.ClaimVIP(ctx, uid, token, "upgrade", "same-request", date, v.Upgrades[1].RewardID, *now); !errors.Is(e, xerr.ErrInvalid) {
			t.Fatal("request rebound to another reward", e)
		}
		if _, e := m.ClaimVIP(ctx, uid, token, "upgrade", "bulk-denied", date, "", *now); !errors.Is(e, xerr.ErrInvalid) {
			t.Fatal("bulk claim accepted", e)
		}
		if _, e := m.ClaimVIP(ctx, uid, token, "upgrade", "missing-reward", date, "another-user-reward", *now); !errors.Is(e, xerr.ErrVIPEmpty) {
			t.Fatal("foreign reward accepted", e)
		}
		for _, reward := range v.Upgrades[1:] {
			if _, e := m.ClaimVIP(ctx, uid, token, "upgrade", "single-"+reward.RewardID, date, reward.RewardID, *now); e != nil {
				t.Fatal(e)
			}
		}
		claimed, readErr := m.ReadVIP(ctx, uid, token, *now)
		if readErr != nil || claimed.UpgradeTotal != 0 || len(claimed.Upgrades) != 4 {
			t.Fatal("claimed history missing or counted as pending", claimed, readErr)
		}
		for _, reward := range claimed.Upgrades {
			if reward.Status != "claimed" {
				t.Fatal("incorrect reward state", reward)
			}
		}
		var wallet LobbyWalletBalance
		db.Where("uid = ?", uid).Take(&wallet)
		if wallet.Coins != 56 {
			t.Fatal(wallet)
		}
		*now = now.Add(90 * 24 * time.Hour)
		if err = m.TickVIP(ctx, *now); err != nil {
			t.Fatal(err)
		}
		v, _ = m.ReadVIP(ctx, uid, token, *now)
		if v.State.Level != 2 || v.State.UpgradeBet != 0 || v.State.UpgradeRecharge != 0 || v.State.HighestLevel != 4 {
			t.Fatal(v.State)
		}
		replay, e := m.ClaimVIP(ctx, uid, token, "upgrade", "same-request", date, v.Upgrades[0].RewardID, *now)
		if e != nil || replay.Batch.TotalReward != v.Upgrades[0].Amount {
			t.Fatal(replay, e)
		}
	})

	t.Run("protection_totals_upgrade_only_after_both_targets", func(t *testing.T) {
		uid, token, m, a, now := newUser(t, vipTestConfig())
		record(t, a, uid, EventGameBet, 1105, *now)
		record(t, a, uid, EventRechargeSuccess, 50, *now)
		*now = now.Add(30 * 24 * time.Hour)
		v, err := m.ReadVIP(ctx, uid, token, *now)
		if err != nil || v.State.Level != 2 || v.State.UpgradeBet != 0 || v.State.UpgradeRecharge != 0 || v.State.ProtectionEnd == nil {
			t.Fatal(v, err)
		}
		record(t, a, uid, EventGameBet, 6000, *now)
		v, err = m.ReadVIP(ctx, uid, token, *now)
		if err != nil || v.State.Level != 2 || v.State.UpgradeBet != 0 || v.State.ProtectionBet != 6000 || v.State.ProtectionEnd == nil {
			t.Fatal(v, err)
		}
		record(t, a, uid, EventRechargeSuccess, 150, *now)
		v, err = m.ReadVIP(ctx, uid, token, *now)
		if err != nil || v.State.Level != 3 || v.State.UpgradeBet != 1000 || v.State.UpgradeRecharge != 150 || v.State.ProtectionEnd != nil || v.UpgradeTotal != 28 {
			t.Fatal(v, err)
		}
	})
	t.Run("recharge_excess_is_preserved_until_betting_target", func(t *testing.T) {
		uid, token, m, a, now := newUser(t, vipTestConfig())
		record(t, a, uid, EventGameBet, 1105, *now)
		*now = now.Add(30 * 24 * time.Hour)
		record(t, a, uid, EventRechargeSuccess, 500, *now)
		v, err := m.ReadVIP(ctx, uid, token, *now)
		if err != nil || v.State.UpgradeRecharge != 0 || v.State.ProtectionRecharge != 500 || v.State.ProtectionEnd == nil {
			t.Fatal(v, err)
		}
		record(t, a, uid, EventGameBet, 150, *now)
		v, err = m.ReadVIP(ctx, uid, token, *now)
		if err != nil || v.State.Level != 2 || v.State.UpgradeBet != 150 || v.State.UpgradeRecharge != 500 || v.State.ProtectionEnd != nil {
			t.Fatal(v, err)
		}
	})
	t.Run("payroll_snapshot_and_claim_only_credit", func(t *testing.T) {
		uid, token, m, a, now := newUser(t, vipTestConfig())
		record(t, a, uid, EventGameBet, 1100, *now)
		record(t, a, uid, EventRechargeSuccess, 100, *now)
		*now = time.Date(2026, 6, 1, 0, 0, 0, 0, loc)
		if err := m.TickVIP(ctx, *now); err != nil {
			t.Fatal(err)
		}
		v, err := m.ReadVIP(ctx, uid, token, *now)
		if err != nil || v.Weekly.Level != 2 || v.Weekly.Amount != 60 || v.Monthly.Amount != 80 || v.Monthly.Status != "pending" {
			t.Fatal(v, err)
		}
		var wallet LobbyWalletBalance
		db.Where("uid = ?", uid).Take(&wallet)
		if wallet.Coins != 0 {
			t.Fatal("settlement credited wallet", wallet)
		}
		record(t, a, uid, EventGameBet, 5000, *now)
		v, _ = m.ReadVIP(ctx, uid, token, *now)
		if v.State.Level != 3 || v.Weekly.Level != 2 || v.Monthly.Level != 2 || v.WeeklyPreview.Level != 3 {
			t.Fatal(v)
		}
		cfg := m.Config
		m.Config.Levels = append([]config.VIPLevel(nil), m.Config.Levels...)
		m.Config.Levels[2].WeeklyReward = 999
		r, err := m.ClaimVIP(ctx, uid, token, "weekly", "weekly-1", "2026-06-01", "", *now)
		if err != nil || r.Batch.TotalReward != 60 {
			t.Fatal(r, err)
		}
		r, err = m.ClaimVIP(ctx, uid, token, "monthly", "monthly-1", "2026-06-01", "", *now)
		if err != nil || r.Batch.TotalReward != 80 {
			t.Fatal(r, err)
		}
		db.Where("uid = ?", uid).Take(&wallet)
		if wallet.Coins != 140 {
			t.Fatal(wallet)
		}
		*now = now.Add(24 * time.Hour)
		r, err = m.ClaimVIP(ctx, uid, token, "weekly", "weekly-1", "2026-06-01", "", *now)
		if err != nil || r.Batch.TotalReward != 60 {
			t.Fatal(r, err)
		}
		if _, err = m.ClaimVIP(ctx, uid, token, "weekly", "new-id", "2026-06-02", "", *now); !errors.Is(err, xerr.ErrVIPEmpty) {
			t.Fatal(err)
		}
		if _, err = m.ClaimVIP(ctx, uid, token, "upgrade", "new-id", "2026-06-01", "", *now); !errors.Is(err, xerr.ErrReturnDate) {
			t.Fatal(err)
		}
		m.Config = cfg
	})
	t.Run("ineligible_wages_and_expiry", func(t *testing.T) {
		uid, token, m, a, now := newUser(t, vipTestConfig())
		record(t, a, uid, EventGameBet, 1100, *now)
		*now = time.Date(2026, 6, 1, 0, 0, 0, 0, loc)
		v, err := m.ReadVIP(ctx, uid, token, *now)
		if err != nil || v.Weekly.Status != "ineligible" || v.Monthly.Status != "ineligible" {
			t.Fatal(v, err)
		}
		record(t, a, uid, EventRechargeSuccess, 100, *now)
		v, _ = m.ReadVIP(ctx, uid, token, *now)
		if v.Weekly.Status != "ineligible" {
			t.Fatal(v.Weekly)
		}
		if _, err = m.ClaimVIP(ctx, uid, token, "weekly", "no-money", "2026-06-01", "", *now); !errors.Is(err, xerr.ErrVIPEmpty) {
			t.Fatal(err)
		}
		if _, err = m.ClaimVIP(ctx, uid, "bad", "upgrade", "no-money", "2026-06-01", "", *now); !errors.Is(err, xerr.ErrSession) {
			t.Fatal(err)
		}
	})
	t.Run("dual_upgrade_requirements_and_atomic_posting", func(t *testing.T) {
		c := vipTestConfig()
		c.Levels[1].UpgradeRecharge = 100
		uid, token, m, a, now := newUser(t, c)
		record(t, a, uid, EventGameBet, 1100, *now)
		v, _ := m.ReadVIP(ctx, uid, token, *now)
		if v.State.Level != 0 {
			t.Fatal(v)
		}
		record(t, a, uid, EventRechargeSuccess, 150, *now)
		v, _ = m.ReadVIP(ctx, uid, token, *now)
		if v.State.Level != 2 || v.State.UpgradeRecharge != 50 || v.UpgradeTotal != 10 {
			t.Fatal(v)
		}
		date := now.In(loc).Format(time.DateOnly)
		db.Model(&LobbyWalletBalance{}).Where("uid = ?", uid).Update("coins", int64(math.MaxInt64))
		if _, err := m.ClaimVIP(ctx, uid, token, "upgrade", "overflow", date, v.Upgrades[0].RewardID, *now); !errors.Is(err, xerr.ErrBalanceLimit) {
			t.Fatal(err)
		}
		db.Model(&LobbyWalletBalance{}).Where("uid = ?", uid).Update("coins", int64(0))
		callback := "vip_test_ledger_failure"
		if err := db.Callback().Create().Before("gorm:create").Register(callback, func(tx *gorm.DB) {
			if e, ok := tx.Statement.Dest.(*LobbyCoinLedger); ok && e.UID == uid {
				tx.AddError(fmt.Errorf("test posting failure"))
			}
		}); err != nil {
			t.Fatal(err)
		}
		_, err := m.ClaimVIP(ctx, uid, token, "upgrade", "failed", date, v.Upgrades[0].RewardID, *now)
		if e := db.Callback().Create().Remove(callback); e != nil {
			t.Fatal(e)
		}
		if err == nil {
			t.Fatal("expected posting failure")
		}
		v, _ = m.ReadVIP(ctx, uid, token, *now)
		if v.UpgradeTotal != 10 {
			t.Fatal("claim rolled forward", v)
		}
		var count int64
		db.Model(&LobbyVipClaimBatch{}).Where("uid = ?", uid).Count(&count)
		if count != 0 {
			t.Fatal(count)
		}
	})
	t.Run("zero_keep_conditions_and_game_wins_do_not_reset_idle", func(t *testing.T) {
		c := vipTestConfig()
		c.Levels[1].KeepBet = 0
		c.Levels[1].KeepRecharge = 0
		uid, token, m, a, now := newUser(t, c)
		record(t, a, uid, EventGameBet, 105, *now)
		*now = now.Add(200 * 24 * time.Hour)
		record(t, a, uid, EventGameWin, 100, *now)
		v, err := m.ReadVIP(ctx, uid, token, *now)
		if err != nil || v.State.Level != 1 || v.State.ProtectionEnd != nil || v.State.UpgradeBet != 0 {
			t.Fatal(v, err)
		}
	})
	t.Run("protection_counter_overflow_rolls_back_event", func(t *testing.T) {
		c := vipTestConfig()
		c.Levels[1].KeepBet = math.MaxInt64
		uid, token, m, a, now := newUser(t, c)
		record(t, a, uid, EventGameBet, 105, *now)
		*now = now.Add(30 * 24 * time.Hour)
		record(t, a, uid, EventGameBet, math.MaxInt64-5, *now)
		*now = now.Add(24 * time.Hour)
		e := LobbyActivityEvent{EventID: rand.Text(), UID: uid, GameID: "AG1", EventType: EventGameBet, Amount: 10, OccurredAt: *now}
		if err := a.RecordEvent(ctx, e); !errors.Is(err, xerr.ErrBalanceLimit) {
			t.Fatal(err)
		}
		v, err := m.ReadVIP(ctx, uid, token, *now)
		if err != nil || v.State.ProtectionBet != math.MaxInt64-5 || v.State.UpgradeBet != 0 {
			t.Fatal(v, err)
		}
		var count int64
		db.Model(&LobbyActivityEvent{}).Where("event_id = ?", e.EventID).Count(&count)
		if count != 0 {
			t.Fatal("overflow event was partially committed", count)
		}
	})
}
