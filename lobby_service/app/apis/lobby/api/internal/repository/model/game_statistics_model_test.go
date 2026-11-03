package model

import (
	"apps/pkg/xerr"
	"context"
	"errors"
	"fmt"
	"testing"
	"time"
)

func TestStatisticsIncrementalIdempotentWindowsAndStreaks(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	now := time.Now().UTC().Truncate(time.Minute)
	loc := time.UTC
	m := &GameModel{DB: db, Location: loc}
	uid, e := (&UserModel{DB: db}).Create(ctx, "", "", "stats-session", now.Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	epoch := now.Add(-48 * time.Hour)
	if e = db.Exec("UPDATE lobby_game_statistics_epoch SET started_at=?", epoch).Error; e != nil {
		t.Fatal(e)
	}
	events := []GameCompletion{}
	add := func(seq, win int64, at time.Time) GameCompletion {
		in := GameCompletion{UID: uid, GameID: "AG1", BetID: fmt.Sprint("bet-", seq), Sequence: seq, BetAmount: 100, WinAmount: win, StartedAt: at, EndedAt: at.Add(time.Second)}
		fund := LobbyGameSettlement{UID: uid, GameID: in.GameID, BetID: in.BetID, RequestID: in.BetID, Debit: 100, Credit: win, Status: "confirmed", CreatedAt: at}
		if err := db.Create(&fund).Error; err != nil {
			t.Fatal(err)
		}
		ok, err := m.CompleteGame(ctx, in)
		if err != nil || !ok {
			t.Fatal(ok, err)
		}
		events = append(events, in)
		return in
	}
	one := add(1, 20, now.Add(-25*time.Hour))
	add(2, 50, now.Add(-23*time.Hour))
	add(3, 30, now.Add(-4*time.Minute))
	add(4, 0, now.Add(-3*time.Minute))
	add(5, 200, now.Add(-2*time.Minute))
	if ok, err := m.CompleteGame(ctx, one); err != nil || !ok {
		t.Fatal(ok, err)
	}
	one.WinAmount++
	if _, err := m.CompleteGame(ctx, one); !errors.Is(err, xerr.ErrGameConflict) {
		t.Fatal("changed retry accepted", err)
	}
	r, e := m.ReadRTP(ctx, "AG1", 5, now)
	if e != nil || r.BetAmount != "300" || r.WinAmount != "230" || r.Rounds != 3 || r.Percent != "76.67" || !r.To.Equal(now) || !r.From.Equal(now.Add(-5*time.Minute)) {
		t.Fatal(r, e)
	}
	r, e = m.ReadRTP(ctx, "AG1", 1440, now)
	if e != nil || r.Rounds != 4 || r.WinAmount != "280" {
		t.Fatal(r, e)
	}
	rows, _, e := m.ReadLeaderboard(ctx, "AG1", "wins", "all", now)
	if e != nil || len(rows) != 4 || rows[0].WinAmount != "200" {
		t.Fatal(rows, e)
	}
	rows, _, e = m.ReadLeaderboard(ctx, "AG1", "streak", "all", now)
	if e != nil || len(rows) != 1 || rows[0].Streak != 3 {
		t.Fatal(rows, e)
	}
	rows, _, e = m.ReadLeaderboard(ctx, "AG1", "streak", "week", now)
	if e != nil || rows[0].Streak != 3 {
		t.Fatal(rows, e)
	}
	var count int64
	db.Table("lobby_game_completions").Count(&count)
	if count != 5 {
		t.Fatal(count)
	}
	// Missing sequence must roll back without affecting the counters.
	bad := events[4]
	bad.BetID = "gap"
	bad.Sequence = 7
	if _, err := m.CompleteGame(ctx, bad); err == nil {
		t.Fatal("gap accepted")
	}
	if e = m.RebuildStatistics(ctx, "AG1"); e != nil {
		t.Fatal("rebuild failed", e)
	}
	r, e = m.ReadRTP(ctx, "AG1", 5, now)
	if e != nil || r.Rounds != 3 || r.WinAmount != "230" {
		t.Fatal("rebuild drift", r, e)
	}
	// Older-than-epoch rounds are recorded for delivery deduplication but excluded from all public statistics.
	db.Exec("UPDATE lobby_game_statistics_epoch SET started_at=?", now)
	old := GameCompletion{UID: uid, GameID: "AG1", BetID: "excluded", Sequence: 6, BetAmount: 100, WinAmount: 200, StartedAt: now.Add(-time.Minute), EndedAt: now}
	db.Create(&LobbyGameSettlement{UID: uid, GameID: "AG1", BetID: old.BetID, RequestID: old.BetID, Debit: 100, Credit: 200, Status: "confirmed", CreatedAt: old.StartedAt})
	if included, err := m.CompleteGame(ctx, old); err != nil || included {
		t.Fatal(included, err)
	}
	r, e = m.ReadRTP(ctx, "AG1", 5, now)
	if e != nil || r.Rounds != 3 {
		t.Fatal(r, e)
	}
}
func TestStatisticsTop50AndRollingStreakBoundary(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	now := time.Now().UTC().Truncate(time.Minute)
	m := &GameModel{DB: db, Location: time.UTC}
	uid, e := (&UserModel{DB: db}).Create(ctx, "", "", "top-session", now.Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	db.Exec("UPDATE lobby_game_statistics_epoch SET started_at=?", now.Add(-10*24*time.Hour))
	for i := int64(1); i <= 60; i++ {
		at := now.Add(-2 * time.Minute)
		if i <= 8 {
			at = now.AddDate(0, 0, int(i)-8).Add(-time.Minute)
		}
		in := GameCompletion{UID: uid, GameID: "AG1", BetID: fmt.Sprint(i), Sequence: i, BetAmount: 100, WinAmount: i, StartedAt: at, EndedAt: at.Add(time.Second)}
		db.Create(&LobbyGameSettlement{UID: uid, GameID: in.GameID, BetID: in.BetID, RequestID: in.BetID, Debit: 100, Credit: i, Status: "confirmed", CreatedAt: at})
		if _, e = m.CompleteGame(ctx, in); e != nil {
			t.Fatal(e)
		}
	}
	var count int64
	db.Table("lobby_game_rank_candidates").Where("game_id='AG1' AND period='all' AND board='wins'").Count(&count)
	if count != 50 {
		t.Fatal("top50 not bounded", count)
	}
	rows, _, e := m.ReadLeaderboard(ctx, "AG1", "wins", "all", now)
	if e != nil || len(rows) != 20 || rows[0].WinAmount != "60" {
		t.Fatal(rows, e)
	}
	rows, _, e = m.ReadLeaderboard(ctx, "AG1", "streak", "all", now)
	if e != nil || rows[0].Streak != 60 {
		t.Fatal(rows, e)
	}
	rows, _, e = m.ReadLeaderboard(ctx, "AG1", "streak", "week", now)
	if e != nil || rows[0].Streak != 59 {
		t.Fatal("seven-day window included older wins", rows, e)
	}
	rows, _, e = m.ReadLeaderboard(ctx, "AG1", "multiplier", "week", now)
	if e != nil || rows[0].Multiplier != "0.60" {
		t.Fatal(rows, e)
	}
}
