package model

import (
	"apps/app/apis/lobby/api/internal/config"
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

func TestAdminFinancialReviews(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	token := "admin-test-player"
	uid, e := (&UserModel{DB: db}).Create(ctx, "", "", token, time.Now().Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	m := &RechargeModel{DB: db, ActivityLocation: time.UTC}
	tier := &config.RechargeTier{Amount: 10000, Bonus: 500}
	o, e := m.CreateRecharge(ctx, uid, token, "test-deposit", "tier", tier, time.Now())
	if e != nil {
		t.Fatal(e)
	}
	req := AdminReview{RequestID: "admin-deposit-approve", Username: "finance", Kind: "deposit", OrderID: o.OrderID, Decision: "approve", Reason: "confirmed"}
	var wg sync.WaitGroup
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if s, e := m.AdminReview(ctx, req); e != nil || s != "success" {
				t.Errorf("review %s %v", s, e)
			}
		}()
	}
	wg.Wait()
	var wallet LobbyWalletBalance
	db.Where("uid=?", uid).Take(&wallet)
	var settled LobbyRechargeOrder
	db.Where("order_id=?", o.OrderID).Take(&settled)
	if settled.Coins != 10500 {
		t.Fatalf("order balance snapshot %d", settled.Coins)
	}
	if wallet.Coins != 10500 {
		t.Fatalf("balance %d", wallet.Coins)
	}
	var n int64
	db.Table("lobby_admin_audits").Count(&n)
	if n != 1 {
		t.Fatalf("audit %d", n)
	}
	req.Decision = "return"
	if _, e = m.AdminReview(ctx, req); !errors.Is(e, ErrAdminConflict) {
		t.Fatalf("conflicting retry %v", e)
	}
	if e = (&WalletAccountModel{DB: db}).SaveAccount(ctx, uid, "test1", "123456", "Test"); e != nil {
		t.Fatal(e)
	}
	if e = db.Exec("UPDATE lobby_turnover_balances SET remaining=0 WHERE uid=?", uid).Error; e != nil {
		t.Fatal(e)
	}
	withdraw := &WithdrawalModel{DB: db}
	w, e := withdraw.Create(ctx, uid, token, "withdraw-test", "test1", "tier", &config.RechargeTier{Amount: 5000})
	if e != nil {
		t.Fatal(e)
	}
	s, e := m.AdminReview(ctx, AdminReview{RequestID: "admin-withdraw-return", Username: "finance", Kind: "withdrawal", OrderID: w.OrderID, Decision: "return", Reason: "rejected"})
	if e != nil || s != "failed" {
		t.Fatalf("return %s %v", s, e)
	}
	db.Where("uid=?", uid).Take(&wallet)
	if wallet.Coins != 10500 {
		t.Fatalf("refund balance %d", wallet.Coins)
	}
	// An audit failure must roll back both wallet posting and order transition.
	o, e = m.CreateRecharge(ctx, uid, token, "test-rollback", "tier", tier, time.Now())
	if e != nil {
		t.Fatal(e)
	}
	if e = db.Exec("ALTER TABLE lobby_admin_audits ADD CONSTRAINT audit_reject CHECK (action <> 'orders.approve') NOT VALID").Error; e != nil {
		t.Fatal(e)
	}
	_, e = m.AdminReview(ctx, AdminReview{RequestID: "admin-rollback", Username: "finance", Kind: "deposit", OrderID: o.OrderID, Decision: "approve", Reason: "rollback"})
	if e == nil {
		t.Fatal("expected audit failure")
	}
	db.Where("uid=?", uid).Take(&wallet)
	if wallet.Coins != 10500 {
		t.Fatalf("non-atomic audit %d", wallet.Coins)
	}
	db.Where("order_id=?", o.OrderID).Take(o)
	if o.Status != "pending" {
		t.Fatalf("order %s", o.Status)
	}
}

func TestAdminReviewPaymentWorkerRace(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	token := "admin-worker-race"
	uid, e := (&UserModel{DB: db}).Create(ctx, "", "", token, time.Now().Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	m := &RechargeModel{DB: db, ActivityLocation: time.UTC}
	o, e := m.CreateRecharge(ctx, uid, token, "race-deposit", "tier", &config.RechargeTier{Amount: 10000}, time.Now())
	if e != nil {
		t.Fatal(e)
	}
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		if e := m.SettleDue(ctx, time.Now().Add(time.Minute)); e != nil {
			t.Error(e)
		}
	}()
	go func() {
		defer wg.Done()
		_, e := m.AdminReview(ctx, AdminReview{RequestID: "admin-worker-race", Username: "finance", Kind: "deposit", OrderID: o.OrderID, Decision: "approve", Reason: "confirm"})
		if e != nil && !errors.Is(e, ErrAdminConflict) {
			t.Error(e)
		}
	}()
	wg.Wait()
	var wallet LobbyWalletBalance
	if e = db.Where("uid=?", uid).Take(&wallet).Error; e != nil {
		t.Fatal(e)
	}
	if wallet.Coins != 10000 {
		t.Fatalf("double credit %d", wallet.Coins)
	}
	var n int64
	db.Model(&LobbyCoinLedger{}).Where("order_id=?", o.OrderID).Count(&n)
	if n != 1 {
		t.Fatalf("ledger %d", n)
	}
	o, e = m.CreateRecharge(ctx, uid, token, "return-deposit", "tier", &config.RechargeTier{Amount: 10000}, time.Now())
	if e != nil {
		t.Fatal(e)
	}
	_, e = m.AdminReview(ctx, AdminReview{RequestID: "admin-close-deposit", Username: "finance", Kind: "deposit", OrderID: o.OrderID, Decision: "return", Reason: "close"})
	if e != nil {
		t.Fatal(e)
	}
	if e = m.SettleDue(ctx, time.Now().Add(time.Minute)); e != nil {
		t.Fatal(e)
	}
	db.Where("uid=?", uid).Take(&wallet)
	if wallet.Coins != 10000 {
		t.Fatalf("closed deposit posted %d", wallet.Coins)
	}
}

func TestAdminWithdrawalApprovalIsReviewOnly(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	token := "review-only"
	uid, e := (&UserModel{DB: db}).Create(ctx, "", "", token, time.Now().Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	if e = db.Model(&LobbyWalletBalance{}).Where("uid=?", uid).Update("coins", 10000).Error; e != nil {
		t.Fatal(e)
	}
	if e = (&WalletAccountModel{DB: db}).SaveAccount(ctx, uid, "test1", "123456", "Test"); e != nil {
		t.Fatal(e)
	}
	m := &WithdrawalModel{DB: db}
	o, e := m.Create(ctx, uid, token, "approve-only", "test1", "tier", &config.RechargeTier{Amount: 5000, Bonus: 300})
	if e != nil {
		t.Fatal(e)
	}
	status, e := (&RechargeModel{DB: db}).AdminReview(ctx, AdminReview{RequestID: "approve-review-only", Username: "finance", Kind: "withdrawal", OrderID: o.OrderID, Decision: "approve", Reason: "approved for payout"})
	if e != nil || status != "approved" {
		t.Fatalf("review %s %v", status, e)
	}
	var wallet LobbyWalletBalance
	db.Where("uid=?", uid).Take(&wallet)
	var saved LobbyWithdrawalOrder
	db.Where("order_id=?", o.OrderID).Take(&saved)
	if saved.SettledAt != nil {
		t.Fatal("review marked payout settled")
	}
	if wallet.Coins != 5000 {
		t.Fatalf("approval posted payout or bonus: %d", wallet.Coins)
	}
	var n int64
	db.Model(&LobbyCoinLedger{}).Where("order_id=?", o.OrderID).Count(&n)
	if n != 1 {
		t.Fatalf("approval emitted extra ledger: %d", n)
	}
}
