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
	if e != nil || len(rows) != 2 || rows[0].Account != "updated" || rows[1].Name != "李四" {
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
