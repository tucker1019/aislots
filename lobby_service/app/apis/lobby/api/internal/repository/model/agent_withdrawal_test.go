package model

import (
	"context"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/config"
)

func TestAgentWithdrawalReport(t *testing.T) {
	db := vipTestDB(t)
	now := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
	bound := now.Add(-24 * time.Hour)
	users := make([]LobbyUser, 3)
	for i := range users {
		users[i] = LobbyUser{Nickname: "withdrawal-team", AvatarID: 1, CreatedAt: bound}
		if err := db.Create(&users[i]).Error; err != nil {
			t.Fatal(err)
		}
	}
	for i := 1; i < 3; i++ {
		if err := db.Exec(`INSERT INTO lobby_agent_paths(ancestor_uid,descendant_uid,branch_uid,depth,effective_at) VALUES(?,?,?,?,?)`, users[0].UID, users[i].UID, users[1].UID, i, bound).Error; err != nil {
			t.Fatal(err)
		}
	}
	before := bound.Add(-time.Hour)
	tomorrow := now.Add(24 * time.Hour)
	for _, v := range []struct {
		id, status  string
		uid, amount int64
		settled     time.Time
	}{
		{"ok1", "success", users[1].UID, 10000, now},
		{"ok2", "success", users[1].UID, 20000, now},
		{"other", "success", users[2].UID, 5000, now},
		{"pending", "pending", users[1].UID, 90000, now},
		{"failed", "failed", users[1].UID, 90000, now},
		{"before", "success", users[1].UID, 90000, before},
		{"future", "success", users[1].UID, 90000, tomorrow},
	} {
		o := LobbyWithdrawalOrder{OrderID: v.id, UID: v.uid, RequestID: v.id, TierID: "test", Channel: "test", Account: "account", Name: "name", Amount: v.amount, Fee: 100, Status: v.status, CreatedAt: v.settled, SettledAt: &v.settled}
		if err := db.Create(&o).Error; err != nil {
			t.Fatal(err)
		}
	}
	m := AgentModel{DB: db, Location: time.UTC, Config: config.AgentConfig{Providers: map[string][]config.AgentTier{}}}
	q := AgentQuery{UID: users[0].UID, Action: "report", Period: "today", Page: 1}
	result, err := m.Query(context.Background(), q, now)
	if err != nil {
		t.Fatal(err)
	}
	if result.Summary.WithdrawalCount != 2 || result.Summary.WithdrawalAmount != 35000 {
		t.Fatalf("summary: %+v", result.Summary)
	}
	q.Action = "report-details"
	q.Kind = "withdrawal"
	q.Scope = "direct"
	result, err = m.Query(context.Background(), q, now)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Items) != 1 || result.Items[0].Amount != 30000 || result.Items[0].Depth != 1 {
		t.Fatalf("details: %+v", result.Items)
	}
	q.Scope = "other"
	result, err = m.Query(context.Background(), q, now)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Items) != 1 || result.Items[0].Amount != 5000 {
		t.Fatalf("other: %+v", result.Items)
	}
}
