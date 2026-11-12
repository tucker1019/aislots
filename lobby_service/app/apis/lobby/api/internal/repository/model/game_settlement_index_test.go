package model

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"
)

func TestStatisticsSettlementLookupUsesCoveringIndex(t *testing.T) {
	db := vipTestDB(t)
	var valid bool
	if err := db.Raw(`SELECT COALESCE(bool_and(i.indisvalid),false) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=current_schema() AND c.relname='lobby_game_settlements_confirmed_bet'`).Scan(&valid).Error; err != nil || !valid {
		t.Fatalf("valid statistics settlement index required: %v", err)
	}
	user := LobbyUser{Nickname: "index-fixture", AvatarID: 1, AccountType: "experience", CreatedAt: time.Now()}
	if err := db.Create(&user).Error; err != nil {
		t.Fatal(err)
	}
	other := LobbyUser{Nickname: "index-other", AvatarID: 2, AccountType: "experience", CreatedAt: time.Now()}
	if err := db.Create(&other).Error; err != nil {
		t.Fatal(err)
	}
	at := time.Now().UTC().Truncate(time.Microsecond)
	if err := db.Exec(`INSERT INTO lobby_game_settlements(request_id,uid,game_id,bet_id,debit,credit,status,coins,created_at) SELECT 'fixture-'||i,?,'AG1','bet-'||i,100,0,'confirmed',0,? FROM generate_series(1,20000) i`, user.UID, at).Error; err != nil {
		t.Fatal(err)
	}
	for _, row := range []LobbyGameSettlement{
		{RequestID: "credit", UID: user.UID, GameID: "AG1", BetID: "bet-19999", Credit: 25, Status: "confirmed", CreatedAt: at.Add(time.Second)},
		{RequestID: "rejected", UID: user.UID, GameID: "AG1", BetID: "bet-19999", Debit: 500, Status: "rejected", CreatedAt: at.Add(-time.Second)},
		{RequestID: "other-user", UID: other.UID, GameID: "AG1", BetID: "bet-19999", Credit: 999, Status: "confirmed", CreatedAt: at},
		{RequestID: "other-game", UID: user.UID, GameID: "AG2", BetID: "bet-19999", Credit: 777, Status: "confirmed", CreatedAt: at},
	} {
		if err := db.Create(&row).Error; err != nil {
			t.Fatal(err)
		}
	}
	if err := db.Exec("ANALYZE lobby_game_settlements").Error; err != nil {
		t.Fatal(err)
	}
	query := `SELECT COALESCE(SUM(debit),0)::text AS debit,COALESCE(SUM(credit),0)::text AS credit,MIN(created_at) AS started FROM lobby_game_settlements WHERE uid=? AND game_id=? AND bet_id=? AND status='confirmed'`
	var funds struct {
		Debit, Credit string
		Started       time.Time
	}
	if err := db.Raw(query, user.UID, "AG1", "bet-19999").Scan(&funds).Error; err != nil {
		t.Fatal(err)
	}
	if funds.Debit != "100" || funds.Credit != "25" || !funds.Started.Equal(at) {
		t.Fatal("settlement totals changed", funds)
	}
	var plan string
	if err := db.Raw("EXPLAIN (FORMAT JSON) "+query, user.UID, "AG1", "bet-19999").Row().Scan(&plan); err != nil {
		t.Fatal(err)
	}
	var decoded any
	if err := json.Unmarshal([]byte(plan), &decoded); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(plan, "lobby_game_settlements_confirmed_bet") || strings.Contains(plan, "Seq Scan") {
		t.Fatal("statistics lookup must use its index", plan)
	}
	m := GameModel{DB: db, Location: time.UTC}
	event := GameCompletion{UID: user.UID, GameID: "AG1", BetID: "bet-19999", Sequence: 1, BetAmount: 100, WinAmount: 25, StartedAt: at, EndedAt: at.Add(time.Second)}
	for i := 0; i < 2; i++ {
		included, err := m.CompleteGame(context.Background(), event)
		if err != nil || !included {
			t.Fatal("indexed completion/retry", included, err)
		}
	}
	for i := 0; i < 2; i++ {
		if err := db.Exec(`CREATE INDEX IF NOT EXISTS lobby_game_settlements_confirmed_bet ON lobby_game_settlements(uid,game_id,bet_id) INCLUDE(debit,credit,created_at) WHERE status='confirmed'`).Error; err != nil {
			t.Fatal(fmt.Errorf("idempotent index migration: %w", err))
		}
	}
}

// Includes successful payout ranking and streak updates, not just the SUM query.
// All data lives in a disposable schema created by vipTestDB.
func BenchmarkStatisticsIndexedCompletion(b *testing.B) {
	db := vipTestDB(b)
	ctx := context.Background()
	at := time.Now().UTC().Truncate(time.Microsecond)
	user := LobbyUser{Nickname: "benchmark", AvatarID: 1, AccountType: "experience", CreatedAt: at}
	if err := db.Create(&user).Error; err != nil {
		b.Fatal(err)
	}
	if err := db.Exec(`INSERT INTO lobby_game_settlements(request_id,uid,game_id,bet_id,debit,credit,status,coins,created_at) SELECT 'background-'||i,?,'AG1','background-'||i,100,0,'confirmed',0,? FROM generate_series(1,20000) i`, user.UID, at).Error; err != nil {
		b.Fatal(err)
	}
	events := make([]GameCompletion, b.N)
	for i := range events {
		start := at.Add(time.Duration(i) * time.Microsecond)
		id := fmt.Sprintf("benchmark-%d", i)
		events[i] = GameCompletion{UID: user.UID, GameID: "AG1", BetID: id, Sequence: int64(i + 1), BetAmount: 100, WinAmount: 40, StartedAt: start, EndedAt: start.Add(time.Second)}
		row := LobbyGameSettlement{RequestID: id, UID: user.UID, GameID: "AG1", BetID: id, Debit: 100, Credit: 40, Status: "confirmed", CreatedAt: start}
		if err := db.Create(&row).Error; err != nil {
			b.Fatal(err)
		}
	}
	if err := db.Exec("ANALYZE lobby_game_settlements").Error; err != nil {
		b.Fatal(err)
	}
	m := GameModel{DB: db, Location: time.UTC}
	b.ResetTimer()
	for _, event := range events {
		included, err := m.CompleteGame(ctx, event)
		if err != nil || !included {
			b.Fatal(included, err)
		}
	}
	b.StopTimer()
	b.ReportMetric(float64(b.N)/b.Elapsed().Seconds(), "events/s")
}
