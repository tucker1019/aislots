package model

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"apps/pkg/xerr"
)

func TestGameTicketsAndWallet(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	now := time.Now().UTC()
	sid := strings.Repeat("s", 64)
	uid, e := (&UserModel{DB: db}).Create(ctx, "", "", sid, now.Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	m := &GameModel{DB: db, Location: time.UTC}
	if e = db.Model(&LobbyWalletBalance{}).Where("uid = ?", uid).Update("coins", 1000).Error; e != nil {
		t.Fatal(e)
	}
	if e = m.Issue(ctx, uid, "bad", "ticket", "AG1", now.Add(time.Minute)); e == nil {
		t.Fatal("invalid user issued ticket")
	}
	if e = m.Issue(ctx, uid, sid, "ticket", "AG1", now.Add(time.Minute)); e != nil {
		t.Fatal(e)
	}
	if _, e = m.Exchange(ctx, "ticket", "redeem-1", "other", now); !errors.Is(e, xerr.ErrGameTicket) {
		t.Fatal(e)
	}
	if got, e := m.Exchange(ctx, "ticket", "redeem-1", "AG1", now); e != nil || got != uid {
		t.Fatal(got, e)
	}
	if got, e := m.Exchange(ctx, "ticket", "redeem-1", "AG1", now.Add(2*time.Minute)); e != nil || got != uid {
		t.Fatal("lost response could not retry", e)
	}
	if _, e = m.Exchange(ctx, "ticket", "redeem-2", "AG1", now); !errors.Is(e, xerr.ErrGameTicket) {
		t.Fatal("ticket used twice", e)
	}
	if e = m.Issue(ctx, uid, sid, "expired", "AG1", now.Add(-time.Second)); e != nil {
		t.Fatal(e)
	}
	if _, e = m.Exchange(ctx, "expired", "redeem-1", "AG1", now); !errors.Is(e, xerr.ErrGameTicket) {
		t.Fatal(e)
	}
	in := LobbyGameSettlement{RequestID: "step1", UID: uid, GameID: "AG1", BetID: "bet1", Debit: 100, Credit: 20}
	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			v, e := m.Settle(ctx, &in, now)
			if e != nil || v.Coins != 920 || v.Status != "confirmed" {
				t.Error(v, e)
			}
		}()
	}
	wg.Wait()
	v, e := m.Settle(ctx, &LobbyGameSettlement{RequestID: "step2", UID: uid, GameID: "AG1", BetID: "bet1", Credit: 30}, now)
	if e != nil || v.Coins != 950 {
		t.Fatal(v, e)
	}
	_, e = m.Settle(ctx, &LobbyGameSettlement{RequestID: "step1", UID: uid, GameID: "AG1", BetID: "bet1", Debit: 101}, now)
	if !errors.Is(e, xerr.ErrGameConflict) {
		t.Fatal("changed retry", e)
	}
	_, e = m.Settle(ctx, &LobbyGameSettlement{RequestID: "another-debit", UID: uid, GameID: "AG1", BetID: "bet1", Debit: 100}, now)
	if !errors.Is(e, xerr.ErrGameConflict) {
		t.Fatal("charged paid bet twice", e)
	}
	v, e = m.Settle(ctx, &LobbyGameSettlement{RequestID: "no-funds", UID: uid, GameID: "AG1", BetID: "bet2", Debit: 1000, Credit: 5000}, now)
	if e != nil || v.Status != "rejected" || v.Coins != 950 {
		t.Fatal("insufficient debit paid credit", v, e)
	}
	var daily LobbyActivityDaily
	if e = db.Where("uid = ?", uid).Take(&daily).Error; e != nil || daily.BetAmount != 100 || daily.ValidBet != 100 || daily.WinAmount != 50 {
		t.Fatal(daily, e)
	}
	var count int64
	db.Model(&LobbyCoinLedger{}).Where("uid = ?", uid).Count(&count)
	if count != 3 {
		t.Fatal("duplicated/missing ledger", count)
	}
}
