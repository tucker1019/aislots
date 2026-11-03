package model

import (
	"context"
	"testing"
	"time"
)

func TestGameRecordsGroupFreeAndUserIsolation(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	now := time.Now().UTC()
	uid, e := (&UserModel{DB: db}).Create(ctx, "", "", "record-session", now.Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	entries := []LobbyGameSettlement{
		{RequestID: "paid", UID: uid, GameID: "AG1", BetID: "bet", Debit: 100, Credit: 20, Status: "confirmed", CreatedAt: now},
		{RequestID: "free", UID: uid, GameID: "AG1", BetID: "bet", Credit: 250, Status: "confirmed", CreatedAt: now.Add(24 * time.Hour)},
		{RequestID: "rejected", UID: uid, GameID: "AG1", BetID: "bad", Debit: 999, Status: "rejected", CreatedAt: now},
	}
	if e = db.Create(&entries).Error; e != nil {
		t.Fatal(e)
	}
	m := &GameModel{DB: db}
	rows, sum, e := m.Records(ctx, uid, now.Add(-time.Hour), now.Add(time.Hour), 1, nil)
	if e != nil || len(rows) != 1 || sum.Count != 1 || sum.BetAmount != 100 || sum.Profit != 170 {
		t.Fatal(rows, sum, e)
	}
	rows, sum, e = m.Records(ctx, uid+1000, now.Add(-time.Hour), now.Add(time.Hour), 1, nil)
	if e != nil || len(rows) != 0 || sum.Count != 0 {
		t.Fatal(rows, sum, e)
	}
	rows, sum, e = m.Records(ctx, uid, now.Add(23*time.Hour), now.Add(25*time.Hour), 1, nil)
	if e != nil || len(rows) != 0 || sum.Count != 0 {
		t.Fatal("free round became separate bet", rows, sum, e)
	}
	rows, sum, e = m.Records(ctx, uid, now.Add(-time.Hour), now.Add(time.Hour), 1, []string{"OTHER"})
	if e != nil || len(rows) != 0 || sum.Count != 0 {
		t.Fatal("provider filter ignored", rows, sum, e)
	}
	rows, sum, e = m.Records(ctx, uid, now.Add(-time.Hour), now.Add(time.Hour), 1, []string{"AG1"})
	if e != nil || len(rows) != 1 || sum.Profit != 170 {
		t.Fatal("provider aggregation changed", rows, sum, e)
	}
}
