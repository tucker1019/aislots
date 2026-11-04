package model

import (
	"context"
	"sync"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/config"
)

func TestWithdrawalFinancialLifecycle(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	token := "withdrawal-test-session"
	uid, err := (&UserModel{DB: db}).Create(ctx, "", "", token, time.Now().Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if err = db.Model(&LobbyWalletBalance{}).Where("uid=?", uid).Update("coins", 100000).Error; err != nil {
		t.Fatal(err)
	}
	accounts := &WalletAccountModel{DB: db}
	if err = accounts.SaveAccount(ctx, uid, "test1", "original", "测试"); err != nil {
		t.Fatal(err)
	}
	m := &WithdrawalModel{DB: db}
	balance := func(want int64) {
		t.Helper()
		var row LobbyWalletBalance
		if e := db.Where("uid=?", uid).Take(&row).Error; e != nil || row.Coins != want {
			t.Fatalf("balance=%d want=%d err=%v", row.Coins, want, e)
		}
	}
	tier := &config.RechargeTier{Amount: 5000, Fee: 150}
	var wg sync.WaitGroup
	ids := make(chan string, 8)
	errs := make(chan error, 8)
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			o, e := m.Create(ctx, uid, token, "duplicate-request", "test1", "50", tier)
			if e != nil {
				errs <- e
				return
			}
			ids <- o.OrderID
		}()
	}
	wg.Wait()
	close(ids)
	close(errs)
	for e := range errs {
		t.Fatal(e)
	}
	id := ""
	for v := range ids {
		if id != "" && id != v {
			t.Fatal("duplicate order")
		}
		id = v
	}
	balance(95000)
	if err = accounts.SaveAccount(ctx, uid, "test1", "edited", "修改"); err != nil {
		t.Fatal(err)
	}
	o, err := m.Info(ctx, uid, id)
	if err != nil || o.Account != "original" || o.Amount-o.Fee != 4850 {
		t.Fatal(o, err)
	}
	for range 2 {
		if _, err = m.Review(ctx, uid, token, id, "approve"); err != nil {
			t.Fatal(err)
		}
	}
	balance(95000)
	if _, err = m.Review(ctx, uid, token, id, "return"); err == nil {
		t.Fatal("opposite review accepted")
	}
	bonus := &config.RechargeTier{Amount: 20000, Bonus: 200}
	o, err = m.Create(ctx, uid, token, "bonus-request", "test1", "200", bonus)
	if err != nil {
		t.Fatal(err)
	}
	balance(75000)
	for range 2 {
		if _, err = m.Review(ctx, uid, token, o.OrderID, "approve"); err != nil {
			t.Fatal(err)
		}
	}
	balance(75200)
	// Withdrawal bonus is a new credit and must be wagered before the next application.
	if err = (&ActivityModel{DB: db, Location: time.UTC}).RecordEvent(ctx, LobbyActivityEvent{UID: uid, EventID: "withdrawal-bonus-turnover", EventType: EventGameBet, GameID: "AG1", Amount: 200, OccurredAt: time.Now().UTC().Add(time.Second)}); err != nil {
		t.Fatal(err)
	}
	o, err = m.Create(ctx, uid, token, "return-request", "test1", "200", bonus)
	if err != nil {
		t.Fatal(err)
	}
	for range 2 {
		if _, err = m.Review(ctx, uid, token, o.OrderID, "return"); err != nil {
			t.Fatal(err)
		}
	}
	balance(75200)
	var count int64
	db.Model(&LobbyCoinLedger{}).Where("uid=?", uid).Count(&count)
	if count != 5 {
		t.Fatalf("ledger count=%d", count)
	}
	if _, err = m.Info(ctx, uid+1, id); err == nil {
		t.Fatal("other user can read order")
	}
	if _, err = m.Create(ctx, uid, token, "no-funds-request", "test1", "large", &config.RechargeTier{Amount: 999999}); err == nil {
		t.Fatal("insufficient funds accepted")
	}
	balance(75200)
	rows, err := m.CashOrders(ctx, uid, "all", time.Now().Add(-time.Hour), time.Now().Add(time.Hour), time.Time{}, "")
	if err != nil || len(rows) != 3 {
		t.Fatal(rows, err)
	}
	// Competing approvals and returns must produce exactly one final transfer.
	race, err := m.Create(ctx, uid, token, "race-review-request", "test1", "200", bonus)
	if err != nil {
		t.Fatal(err)
	}
	for i := range 8 {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			decision := "approve"
			if i%2 == 0 {
				decision = "return"
			}
			_, _ = m.Review(ctx, uid, token, race.OrderID, decision)
		}(i)
	}
	wg.Wait()
	final, err := m.Info(ctx, uid, race.OrderID)
	if err != nil {
		t.Fatal(err)
	}
	switch final.Status {
	case "success":
		balance(55400)
	case "failed":
		balance(75200)
	default:
		t.Fatal("order not finalized", final.Status)
	}
	db.Model(&LobbyCoinLedger{}).Where("order_id=?", race.OrderID).Count(&count)
	if count != 2 {
		t.Fatalf("review transfers=%d", count)
	}
}
