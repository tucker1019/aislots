package model

import (
	"context"
	"crypto/rand"
	"errors"
	"math"
	"sync"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/pkg/xerr"

	"gorm.io/gorm"
)

func TestNewbiePostgres(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	base := time.Date(2027, 1, 1, 10, 15, 0, 0, time.UTC)
	cfg := config.NewbieConfig{Version: "v1", DurationDays: 3, Tiers: []config.NewbieTier{{ID: "a", RequiredRecharge: 100, Reward: 10}, {ID: "b", RequiredRecharge: 500, Reward: 50}, {ID: "c", RequiredRecharge: 1000, Reward: 100}}}
	newUser := func(t *testing.T, c config.NewbieConfig) (int64, string, *NewbieModel) {
		t.Helper()
		token := rand.Text() + rand.Text()
		uid, err := (&UserModel{DB: db}).Create(ctx, "", "", token, base.AddDate(1, 0, 0))
		if err != nil {
			t.Fatal(err)
		}
		if err = db.Model(&LobbyUser{}).Where("uid = ?", uid).Update("created_at", base).Error; err != nil {
			t.Fatal(err)
		}
		return uid, token, &NewbieModel{DB: db, Config: c}
	}
	deposit := func(t *testing.T, uid int64, token string, amount, bonus, fee int64, created, settled time.Time) *LobbyRechargeOrder {
		t.Helper()
		r := &RechargeModel{DB: db}
		tier := &config.RechargeTier{ID: "test", Amount: amount, Bonus: bonus, Fee: fee}
		order, err := r.CreateRecharge(ctx, uid, token, rand.Text(), tier.ID, tier, created)
		if err != nil {
			t.Fatal(err)
		}
		if !settled.IsZero() {
			if err = r.SettleDue(ctx, settled); err != nil {
				t.Fatal(err)
			}
		}
		return order
	}
	t.Run("pending_principal_progress_incremental_claims_and_replays", func(t *testing.T) {
		uid, token, m := newUser(t, cfg)
		v, err := m.ReadNewbie(ctx, uid, token, base)
		if err != nil || v.Amount != 0 || v.Items[0].Remaining != 100 || !v.Enrollment.EndsAt.Equal(base.Add(72*time.Hour)) {
			t.Fatal(v, err)
		}
		order := deposit(t, uid, token, 100, 0, 2, base, time.Time{})
		v, err = m.ReadNewbie(ctx, uid, token, base.Add(time.Second))
		if err != nil || v.Amount != 0 {
			t.Fatal(v, err)
		}
		r := &RechargeModel{DB: db}
		if err = r.SettleDue(ctx, base.Add(4*time.Second)); err != nil {
			t.Fatal(err)
		}
		if err = r.SettleDue(ctx, base.Add(5*time.Second)); err != nil {
			t.Fatal(err)
		}
		v, err = m.ReadNewbie(ctx, uid, token, base.Add(5*time.Second))
		if err != nil || v.Amount != 100 || v.ClaimableTotal != 10 || v.Items[0].Progress != 100 || v.Items[1].Remaining != 400 {
			t.Fatal(v, err)
		}
		first, err := m.ClaimNewbie(ctx, uid, token, "first", base.Add(5*time.Second))
		if err != nil || first.Batch.TotalReward != 10 || first.Batch.Coins != 108 {
			t.Fatal(first, err)
		}
		deposit(t, uid, token, 400, 8, 0, base.Add(time.Hour), base.Add(time.Hour+4*time.Second))
		v, err = m.ReadNewbie(ctx, uid, token, base.Add(2*time.Hour))
		if err != nil || v.Amount != 500 || v.ClaimableTotal != 50 || v.Items[0].Status != "claimed" || v.Items[1].Status != "claimable" {
			t.Fatal(v, err)
		}
		replay, err := m.ClaimNewbie(ctx, uid, token, "first", base.Add(2*time.Hour))
		if err != nil || replay.Batch.ClaimID != first.Batch.ClaimID || replay.Batch.Coins != 108 {
			t.Fatal(replay, err)
		}
		receipt, err := m.ClaimNewbie(ctx, uid, token, "second", base.Add(2*time.Hour))
		if err != nil || receipt.Batch.TotalReward != 50 || receipt.Batch.Coins != 566 || len(receipt.Items) != 1 {
			t.Fatal(receipt, err)
		}
		if _, err = m.ClaimNewbie(ctx, uid, token, "third", base.Add(2*time.Hour)); !errors.Is(err, xerr.ErrNewbieEmpty) {
			t.Fatal(err)
		}
		if _, err = m.ReadNewbie(ctx, uid, "bad", base); !errors.Is(err, xerr.ErrSession) {
			t.Fatal(err)
		}
		if _, err = m.ClaimNewbie(ctx, uid, "bad", "bad", base); !errors.Is(err, xerr.ErrSession) {
			t.Fatal(err)
		}
		// A replayed recharge order does not increase the cumulative amount.
		if _, err = r.CreateRecharge(ctx, uid, token, order.RequestID, "test", nil, base.Add(2*time.Hour)); err != nil {
			t.Fatal(err)
		}
		v, _ = m.ReadNewbie(ctx, uid, token, base.Add(2*time.Hour))
		if v.Amount != 500 {
			t.Fatal(v)
		}
	})
	t.Run("all_tiers_combined_concurrency_and_expired_progress", func(t *testing.T) {
		uid, token, m := newUser(t, cfg)
		deposit(t, uid, token, 1000, 20, 0, base, base.Add(4*time.Second))
		var wg sync.WaitGroup
		for i := 0; i < 12; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				r, err := m.ClaimNewbie(ctx, uid, token, rand.Text(), base.Add(time.Hour))
				if err == nil {
					if r.Batch.TotalReward != 160 || len(r.Items) != 3 {
						t.Error(r)
					}
				} else if !errors.Is(err, xerr.ErrNewbieEmpty) {
					t.Error(err)
				}
			}()
		}
		wg.Wait()
		var wallet LobbyWalletBalance
		db.Where("uid = ?", uid).Take(&wallet)
		if wallet.Coins != 1180 {
			t.Fatal("duplicate award", wallet)
		}
		var count int64
		db.Model(&LobbyNewbieClaimBatch{}).Where("uid = ?", uid).Count(&count)
		if count != 1 {
			t.Fatal(count)
		}
	})
	t.Run("deadline_uses_success_time_and_qualified_rewards_remain", func(t *testing.T) {
		uid, token, m := newUser(t, cfg)
		v, err := m.ReadNewbie(ctx, uid, token, base)
		if err != nil {
			t.Fatal(err)
		}
		deadline := v.Enrollment.EndsAt
		deposit(t, uid, token, 100, 0, 0, deadline.Add(-10*time.Second), deadline.Add(-time.Second))
		deposit(t, uid, token, 900, 0, 0, deadline.Add(-4*time.Second), deadline)
		v, err = m.ReadNewbie(ctx, uid, token, deadline.Add(time.Hour))
		if err != nil || v.Amount != 100 || v.ClaimableTotal != 10 || v.Items[1].Status != "expired" {
			t.Fatal(v, err)
		}
		r, err := m.ClaimNewbie(ctx, uid, token, "after-end", deadline.Add(time.Hour))
		if err != nil || r.Batch.TotalReward != 10 {
			t.Fatal(r, err)
		}
		// Rules fixed on enrollment are unaffected by changing the new-user config.
		m.Config.Version = "v2"
		m.Config.DurationDays = 30
		m.Config.Tiers = []config.NewbieTier{{ID: "new", RequiredRecharge: 1, Reward: 999}}
		v, err = m.ReadNewbie(ctx, uid, token, deadline.Add(time.Hour))
		if err != nil || v.Enrollment.ConfigVersion != "v1" || len(v.Items) != 3 || !v.Enrollment.EndsAt.Equal(deadline) {
			t.Fatal(v, err)
		}
	})
	t.Run("optional_expiry_of_unclaimed_rewards", func(t *testing.T) {
		c := cfg
		c.ExpireUnclaimed = true
		uid, token, m := newUser(t, c)
		deposit(t, uid, token, 100, 0, 0, base, base.Add(4*time.Second))
		v, err := m.ReadNewbie(ctx, uid, token, base.Add(72*time.Hour))
		if err != nil || v.ClaimableTotal != 0 || v.Items[0].Status != "expired" {
			t.Fatal(v, err)
		}
		if _, err = m.ClaimNewbie(ctx, uid, token, "late", base.Add(72*time.Hour)); !errors.Is(err, xerr.ErrNewbieEmpty) {
			t.Fatal(err)
		}
	})
	t.Run("wallet_and_ledger_atomicity", func(t *testing.T) {
		uid, token, m := newUser(t, cfg)
		deposit(t, uid, token, 100, 0, 0, base, base.Add(4*time.Second))
		db.Model(&LobbyWalletBalance{}).Where("uid = ?", uid).Update("coins", int64(math.MaxInt64))
		if _, err := m.ClaimNewbie(ctx, uid, token, "overflow", base.Add(time.Hour)); !errors.Is(err, xerr.ErrBalanceLimit) {
			t.Fatal(err)
		}
		db.Model(&LobbyWalletBalance{}).Where("uid = ?", uid).Update("coins", int64(100))
		name := "newbie_test_posting_failure"
		if err := db.Callback().Create().Before("gorm:create").Register(name, func(tx *gorm.DB) {
			if e, ok := tx.Statement.Dest.(*LobbyCoinLedger); ok && e.UID == uid {
				tx.AddError(errors.New("test failure"))
			}
		}); err != nil {
			t.Fatal(err)
		}
		_, err := m.ClaimNewbie(ctx, uid, token, "retry", base.Add(time.Hour))
		if e := db.Callback().Create().Remove(name); e != nil {
			t.Fatal(e)
		}
		if err == nil {
			t.Fatal("expected failure")
		}
		v, e := m.ReadNewbie(ctx, uid, token, base.Add(time.Hour))
		if e != nil || v.ClaimableTotal != 10 {
			t.Fatal(v, e)
		}
		r, err := m.ClaimNewbie(ctx, uid, token, "retry", base.Add(time.Hour))
		if err != nil || r.Batch.Coins != 110 {
			t.Fatal(r, err)
		}
	})
	t.Run("registration_snapshots_rules_before_first_view", func(t *testing.T) {
		m := &NewbieModel{DB: db, Config: cfg}
		token := rand.Text() + rand.Text()
		uid, err := (&UserModel{DB: db, Newbie: m}).Create(ctx, "", "", token, time.Now().AddDate(1, 0, 0))
		if err != nil {
			t.Fatal(err)
		}
		m.Config.Version = "v2"
		m.Config.DurationDays = 7
		v, err := m.ReadNewbie(ctx, uid, token, time.Now())
		if err != nil || v.Enrollment.ConfigVersion != "v1" || v.Enrollment.DurationDays != 3 {
			t.Fatal(v, err)
		}
	})
	t.Run("old_accounts_cannot_retroactively_join", func(t *testing.T) {
		uid, token, m := newUser(t, cfg)
		deposit(t, uid, token, 1000, 0, 0, base, base.Add(4*time.Second))
		v, err := m.ReadNewbie(ctx, uid, token, base.Add(4*24*time.Hour))
		if err != nil || v.ClaimableTotal != 0 || v.Items[0].Status != "expired" {
			t.Fatal(v, err)
		}
		if _, err = m.ClaimNewbie(ctx, uid, token, "old", base.Add(4*24*time.Hour)); !errors.Is(err, xerr.ErrNewbieEmpty) {
			t.Fatal(err)
		}
	})
}
