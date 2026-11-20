package model

import (
	"context"
	"testing"
	"time"
)

func TestWalletAccountsUniqueAndIsolated(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	u := &UserModel{DB: db}
	uid, e := u.Create(ctx, "", "", "wallet-first-session", time.Now().Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	other, e := u.Create(ctx, "", "", "wallet-other-session", time.Now().Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	m := &WalletAccountModel{DB: db}
	for _, a := range []string{"original", "updated"} {
		if e = m.SaveAccount(ctx, uid, "test1", a, "张三"); e != nil {
			t.Fatal(e)
		}
	}
	if e = m.SaveAccount(ctx, uid, "test2", "other-channel", "李四"); e != nil {
		t.Fatal(e)
	}
	rows, e := m.Accounts(ctx, uid)
	if e != nil || len(rows) != 2 || rows[1].Account != "updated" || rows[0].Name != "李四" {
		t.Fatal(rows, e)
	}
	fresh := &WalletAccountModel{DB: db}
	rows, e = fresh.Accounts(ctx, other)
	if e != nil || len(rows) != 0 {
		t.Fatal("other user can read accounts", rows, e)
	}
	rows, e = fresh.Accounts(ctx, uid)
	if e != nil || len(rows) != 2 {
		t.Fatal("not persisted", rows, e)
	}
}

func TestWalletPreferredLatestAttemptAndBinding(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	m := &WalletAccountModel{DB: db}
	uid, err := (&UserModel{DB: db}).Create(ctx, "", "", "preferred-session", time.Now().Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	for _, channel := range []string{"test1", "test2"} {
		if err = m.SaveAccount(ctx, uid, channel, channel+"-account", "Name"); err != nil {
			t.Fatal(err)
		}
	}
	check := func(want string) {
		t.Helper()
		rows, e := m.Accounts(ctx, uid)
		if e != nil || len(rows) != 2 || rows[0].Channel != want {
			t.Fatalf("want %s, rows %v, error %v", want, rows, e)
		}
	}
	check("test2")
	// Latest failed request must override a newer binding, without requiring success.
	order := LobbyWithdrawalOrder{OrderID: "wdr_preferred", UID: uid, RequestID: "preferred-request", TierID: "tier", Channel: "test1", Account: "test1-account", Name: "Name", Amount: 100, Status: "failed", CreatedAt: time.Now().UTC()}
	if err = db.Create(&order).Error; err != nil {
		t.Fatal(err)
	}
	check("test1")
	for _, status := range []string{"pending", "approved", "success", "failed"} {
		if err = db.Model(&order).Update("status", status).Error; err != nil {
			t.Fatal(err)
		}
		check("test1")
	}
	// Rebinding to another account invalidates the previous account choice.
	if err = m.SaveAccount(ctx, uid, "test1", "changed-account", "Name"); err != nil {
		t.Fatal(err)
	}
	if err = m.SaveAccount(ctx, uid, "test2", "test2-account", "Name"); err != nil {
		t.Fatal(err)
	}
	check("test2")
	if err = db.Where("uid=? AND channel=?", uid, "test1").Delete(&LobbyPayoutAccount{}).Error; err != nil {
		t.Fatal(err)
	}
	rows, err := m.Accounts(ctx, uid)
	if err != nil || len(rows) != 1 || rows[0].Channel != "test2" {
		t.Fatal(rows, err)
	}
}
