package model

import (
	migrations "apps/deploy/migration"
	"context"
	"fmt"
	"gorm.io/gorm"
	"testing"
	"time"
)

func TestAdminOverviewTotalsHistoricalAndIncremental(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	now := time.Now().UTC()
	// Simulate an existing installation before summary initialization.
	if err := db.Exec(`DROP TRIGGER IF EXISTS admin_member_totals ON lobby_users; DROP TRIGGER IF EXISTS admin_game_totals ON lobby_game_settlements`).Error; err != nil {
		t.Fatal(err)
	}
	var real, experience int64
	for _, row := range []struct {
		kind string
		id   *int64
	}{{"real", &real}, {"experience", &experience}} {
		if err := db.Raw(`INSERT INTO lobby_users(account_type,nickname,avatar_id) VALUES(?,?,1) RETURNING uid`, row.kind, row.kind).Scan(row.id).Error; err != nil {
			t.Fatal(err)
		}
	}
	insert := func(request string, uid, debit, credit int64, status string) {
		t.Helper()
		err := db.Exec(`INSERT INTO lobby_game_settlements(request_id,uid,game_id,bet_id,debit,credit,status,coins,created_at) VALUES(?,?,'AG1',?,?,?,?,0,?)`, request, uid, request, debit, credit, status, now).Error
		if err != nil {
			t.Fatal(err)
		}
	}
	insert("historical-real", real, 100, 30, "confirmed")
	insert("historical-experience", experience, 200, 90, "confirmed")
	insert("rejected", real, 999, 999, "rejected")
	if err := db.Exec(`DELETE FROM lobby_admin_overview_initialized`).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec(migrations.Schema).Error; err != nil {
		t.Fatal(err)
	}
	check := func(rbet, rwin, ebet, ewin string) {
		t.Helper()
		v, err := (AdminQueryModel{DB: db}).Overview(ctx, now, nil)
		if err != nil {
			t.Fatal(err)
		}
		if v.RealMembers != 1 || v.ExperienceMembers != 1 || v.RealBet != rbet || v.RealWin != rwin || v.ExperienceBet != ebet || v.ExperienceWin != ewin {
			t.Fatalf("unexpected overview: %+v", v)
		}
	}
	check("100", "30", "200", "90")
	insert("increment", real, 300, 70, "confirmed")
	check("400", "100", "200", "90")
	if err := db.Exec(`INSERT INTO lobby_game_settlements SELECT * FROM lobby_game_settlements WHERE request_id='increment' ON CONFLICT DO NOTHING`).Error; err != nil {
		t.Fatal(err)
	}
	check("400", "100", "200", "90")
	if err := db.Exec(`UPDATE lobby_game_settlements SET status='confirmed' WHERE request_id='rejected'`).Error; err == nil { // Unique paid bet remains its own order.
		check("1399", "1099", "200", "90")
	} else {
		t.Fatal(err)
	}
	if err := db.Exec(migrations.Schema).Error; err != nil {
		t.Fatal(err)
	}
	check("1399", "1099", "200", "90")
	if err := db.Transaction(func(tx *gorm.DB) error {
		if e := tx.Exec(`INSERT INTO lobby_users(account_type,nickname,avatar_id) VALUES('real','rollback',1)`).Error; e != nil {
			return e
		}
		return fmt.Errorf("rollback")
	}); err == nil {
		t.Fatal("expected rollback")
	}
	check("1399", "1099", "200", "90")
}

func TestAdminOverviewReadsOnlySmallTotalsAndExactLargeAmounts(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	now := time.Now().UTC()
	uid, err := (&UserModel{DB: db}).Create(ctx, "", "", "summary-only", now.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		id := fmt.Sprintf("large-%d", i)
		if err = db.Exec(`INSERT INTO lobby_game_settlements(request_id,uid,game_id,bet_id,debit,credit,status,coins) VALUES(?,?,'AG1',?,9000000000000000000,9000000000000000000,'confirmed',0)`, id, uid, id).Error; err != nil {
			t.Fatal(err)
		}
	}
	if err = db.Exec(`ALTER TABLE lobby_users RENAME TO historical_users; ALTER TABLE lobby_game_settlements RENAME TO historical_settlements`).Error; err != nil {
		t.Fatal(err)
	}
	v, err := (AdminQueryModel{DB: db}).Overview(ctx, now, nil)
	if err != nil {
		t.Fatal("overview must not read source users or settlements", err)
	}
	if v.RealMembers != 1 || v.RealBet != "18000000000000000000" || v.RealWin != "18000000000000000000" {
		t.Fatalf("lost precision: %+v", v)
	}
}

func TestAdminOverviewInitializationWithConcurrentWrites(t *testing.T) {
	db := vipTestDB(t)
	if err := db.Exec(`DELETE FROM lobby_admin_overview_initialized`).Error; err != nil {
		t.Fatal(err)
	}
	start := make(chan struct{})
	done := make(chan error, 1)
	go func() { <-start; done <- db.Exec(migrations.Schema).Error }()
	close(start)
	for i := 0; i < 12; i++ {
		err := db.Transaction(func(tx *gorm.DB) error {
			var uid int64
			if e := tx.Raw(`INSERT INTO lobby_users(account_type,nickname,avatar_id) VALUES('real','concurrent',1) RETURNING uid`).Scan(&uid).Error; e != nil {
				return e
			}
			id := fmt.Sprintf("concurrent-%d", i)
			return tx.Exec(`INSERT INTO lobby_game_settlements(request_id,uid,game_id,bet_id,debit,credit,status,coins) VALUES(?,?,'AG1',?,100,30,'confirmed',0)`, id, uid, id).Error
		})
		if err != nil {
			t.Fatal(err)
		}
	}
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	v, err := (AdminQueryModel{DB: db}).Overview(context.Background(), time.Now(), nil)
	if err != nil {
		t.Fatal(err)
	}
	if v.RealMembers != 12 || v.RealBet != "1200" || v.RealWin != "360" {
		t.Fatalf("initialization lost or duplicated writes: %+v", v)
	}
}
