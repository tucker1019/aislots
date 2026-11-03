package model

import (
	"context"
	"testing"
	"time"

	migrations "apps/deploy/migration"
)

func TestUIDStartsAt10000001AndNeverRewinds(t *testing.T) {
	db := vipTestDB(t)
	m := &UserModel{DB: db}
	ctx := context.Background()
	create := func(token string) int64 {
		t.Helper()
		id, err := m.Create(ctx, "", "", token, time.Now().Add(time.Hour))
		if err != nil {
			t.Fatal(err)
		}
		return id
	}
	if id := create("uid-test-a"); id != 10000001 {
		t.Fatalf("first uid = %d, want 10000001", id)
	}
	if id := create("uid-test-b"); id != 10000002 {
		t.Fatalf("second uid = %d", id)
	}
	if err := db.Exec(migrations.Schema).Error; err != nil {
		t.Fatal(err)
	}
	if id := create("uid-test-c"); id != 10000003 {
		t.Fatalf("migration rewound sequence: %d", id)
	}
	if err := db.Exec(`SELECT setval(pg_get_serial_sequence('lobby_users','uid'),10001000,true)`).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(migrations.Schema).Error; err != nil {
		t.Fatal(err)
	}
	if id := create("uid-test-d"); id != 10001001 {
		t.Fatalf("migration moved an advanced sequence backwards: %d", id)
	}
}

func TestUIDMigrationPreservesExistingAccounts(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	if err := db.Exec(`INSERT INTO lobby_users(uid,nickname,avatar_id) OVERRIDING SYSTEM VALUE VALUES(7,'legacy',1);
 INSERT INTO lobby_wallet_balances(uid,coins) VALUES(7,123);
 INSERT INTO lobby_sessions(sid_hash,uid,expires_at) VALUES('legacy-session',7,now()+interval '1 hour')`).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(migrations.Schema).Error; err != nil {
		t.Fatal(err)
	}
	p, err := (&UserModel{DB: db}).Profile(ctx, 7, "legacy-session", time.Now())
	if err != nil || p.UID != 7 || p.Coins != 123 {
		t.Fatal("legacy identity or balance changed", p, err)
	}
	id, err := (&UserModel{DB: db}).Create(ctx, "", "", "new-session", time.Now().Add(time.Hour))
	if err != nil || id != 10000001 {
		t.Fatal(id, err)
	}
}
