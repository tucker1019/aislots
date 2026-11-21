package model

import (
	"context"
	"fmt"
	"testing"
	"time"
)

func TestRecentWinsThresholdsWindowAndExperience(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	now := time.Now().UTC().Truncate(time.Second)
	users := &UserModel{DB: db}
	uid, err := users.Create(ctx, "", "", "recent-session", now.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	add := func(id string, bet, win int64, at time.Time, game, account string, included bool) {
		t.Helper()
		row := LobbyGameCompletion{GameID: game, BetID: id, UID: uid, Sequence: time.Now().UnixNano(), BetAmount: bet, WinAmount: win, StartedAt: at.Add(-time.Second), EndedAt: at, Included: included, AccountType: account}
		if e := db.Omit("PlatformOrderID").Create(&row).Error; e != nil {
			t.Fatal(e)
		}
	}
	add("exact20", 100, 2000, now.Add(-time.Minute), "AG1", "real", true)
	add("below20", 100, 1999, now.Add(-time.Minute), "AG1", "real", true)
	add("exact5threshold", 4000000, 20000000, now.Add(-2*time.Minute), "AG1", "experience", true)
	add("below5", 4000001, 20000000, now.Add(-time.Minute), "AG1", "real", true)
	add("belowAmount", 100000, 19999999, now.Add(-time.Minute), "AG1", "real", true) // >=20x still qualifies
	add("belowBoth", 2000000, 19999999, now.Add(-time.Minute), "AG1", "real", true)
	add("old", 100, 5000, now.Add(-time.Hour-time.Microsecond), "AG1", "real", true)
	add("boundary", 100, 5000, now.Add(-time.Hour), "AG1", "real", true)
	add("future", 100, 5000, now.Add(time.Microsecond), "AG1", "real", true)
	add("excluded", 100, 5000, now, "AG1", "real", false)
	add("hidden", 100, 5000, now, "HIDDEN", "real", true)
	// Multiplying bigint near its maximum must not overflow.
	add("hugeBet", 9000000000000000000, 9000000000000000000, now, "AG1", "real", true)
	if err = db.Exec("UPDATE lobby_game_completions SET leaderboard_participating=false,leaderboard_nickname='Snapshot Name' WHERE bet_id='exact20'").Error; err != nil {
		t.Fatal(err)
	}
	m := &GameModel{DB: db, Location: time.UTC}
	var oldOrderID int64
	if err = db.Table("lobby_game_completions").Select("platform_order_id").Where("bet_id=?", "old").Scan(&oldOrderID).Error; err != nil {
		t.Fatal(err)
	}
	if order, exists, readErr := m.ReadReplayOrder(ctx, oldOrderID); readErr != nil || !exists || order.BetID != "old" || order.GameID != "AG1" || order.UID != uid {
		t.Fatal("replay lookup should not expire after one hour", order, exists, readErr)
	}
	rows, e := m.ReadRecentWins(ctx, []string{"AG1"}, now)
	if e != nil {
		t.Fatal(e)
	}
	found := map[string]bool{}
	var anonymousSnapshot bool
	var snapshotName string
	for _, r := range rows {
		found[r.BetID] = true
		if r.BetID == "exact20" {
			anonymousSnapshot = r.Anonymous
			snapshotName = r.Nickname
		}
		if r.BetAmount == "" || r.AvatarID < 1 || r.AvatarID > 15 {
			t.Fatal("missing detail fields", r)
		}
	}
	if !anonymousSnapshot || snapshotName != "Snapshot Name" {
		t.Fatal("recent win did not preserve completion identity snapshot", anonymousSnapshot, snapshotName)
	}
	if len(rows) != 4 || !found["exact20"] || !found["exact5threshold"] || !found["belowAmount"] || !found["boundary"] {
		t.Fatal(rows)
	}
	if rows, e = m.ReadRecentWins(ctx, nil, now); e != nil || len(rows) != 0 {
		t.Fatal(rows, e)
	}
	for i := 0; i < 55; i++ {
		add(fmt.Sprint("new", i), 100, 5000, now.Add(-time.Duration(i)*time.Second), "AG1", "experience", true)
	}
	rows, e = m.ReadRecentWins(ctx, []string{"AG1"}, now)
	if e != nil || len(rows) != 50 || rows[0].BetID != "new0" || rows[49].BetID != "new49" {
		t.Fatal(rows, e)
	}
}
