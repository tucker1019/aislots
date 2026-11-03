package model

import (
	"context"
	"fmt"
	"testing"
	"time"
)

func TestLedgerFiltersCursorAndIsolation(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	now := time.Now().UTC()
	uid, e := (&UserModel{DB: db}).Create(ctx, "", "", "ledger-test", now.Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	for i := 0; i < 22; i++ {
		r := LobbyCoinLedger{UID: uid, OrderID: fmt.Sprint(i), Source: "act_001", Delta: 100, BalanceBefore: 100, BalanceAfter: 200, CreatedAt: now}
		if e = db.Create(&r).Error; e != nil {
			t.Fatal(e)
		}
	}
	settlement := LobbyGameSettlement{RequestID: "bet-request", UID: uid, GameID: "AG1", BetID: "paid-bet", Debit: 100, Status: "confirmed", CreatedAt: now}
	if e = db.Create(&settlement).Error; e != nil {
		t.Fatal(e)
	}
	r := LobbyCoinLedger{UID: uid, OrderID: "bet-request", Source: "game_001", Delta: -100, BalanceBefore: 200, BalanceAfter: 100, CreatedAt: now}
	if e = db.Create(&r).Error; e != nil {
		t.Fatal(e)
	}
	m := &GameModel{DB: db}
	rows, e := m.Ledger(ctx, uid, now.Add(-time.Hour), now.Add(time.Hour), nil, nil, 0)
	if e != nil || len(rows) != 21 || rows[0].GameID != "AG1" || rows[0].BalanceAfter != 100 {
		t.Fatal(rows, e)
	}
	next, e := m.Ledger(ctx, uid, now.Add(-time.Hour), now.Add(time.Hour), nil, nil, rows[19].ID)
	if e != nil || len(next) != 3 || next[0].ID >= rows[19].ID {
		t.Fatal(next, e)
	}
	rows, e = m.Ledger(ctx, uid, now.Add(-time.Hour), now.Add(time.Hour), []string{"game_001"}, []string{"AG1"}, 0)
	if e != nil || len(rows) != 1 || rows[0].Delta != -100 {
		t.Fatal(rows, e)
	}
	rows, e = m.Ledger(ctx, uid, now.Add(-time.Hour), now.Add(time.Hour), []string{"act_001"}, nil, 0)
	if e != nil || len(rows) != 21 {
		t.Fatal(rows, e)
	}
	_, e = m.LedgerDetail(ctx, uid+1000, r.ID)
	if e == nil {
		t.Fatal("other user could view ledger")
	}
	detail, e := m.LedgerDetail(ctx, uid, r.ID)
	if e != nil || detail.ID != r.ID {
		t.Fatal(detail, e)
	}
}
