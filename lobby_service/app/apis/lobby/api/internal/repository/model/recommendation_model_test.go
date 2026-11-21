package model

import (
	"context"
	"testing"
	"time"
)

func TestRecommendationRebuildUsesFavoritesAndPlayBehavior(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	now := time.Now().UTC().Truncate(time.Second)
	users := &UserModel{DB: db}
	ids := make([]int64, 5)
	for i := range ids {
		uid, err := users.Create(ctx, "", "", "recommendation-test", now.Add(time.Hour))
		if err != nil {
			t.Fatal(err)
		}
		ids[i] = uid
	}
	favorites := &GameFavoriteModel{DB: db}
	for _, game := range []string{"AG1", "AG2"} {
		if err := favorites.Set(ctx, ids[0], game, true); err != nil {
			t.Fatal(err)
		}
	}
	for _, game := range []string{"AG1", "AG2", "AG3"} {
		if err := favorites.Set(ctx, ids[1], game, true); err != nil {
			t.Fatal(err)
		}
	}
	for _, game := range []string{"AG1", "AG4"} {
		if err := favorites.Set(ctx, ids[2], game, true); err != nil {
			t.Fatal(err)
		}
	}
	insertPlay := func(uid int64, game, bet string, at time.Time, account string) {
		t.Helper()
		if err := db.Exec(`INSERT INTO lobby_game_completions(game_id,bet_id,uid,sequence,bet_amount,win_amount,started_at,ended_at,included,account_type) VALUES(?,?,?,?,?,?,?,?,?,?)`, game, bet, uid, 1, 1, 0, at, at.Add(time.Second), true, account).Error; err != nil {
			t.Fatal(err)
		}
	}
	insertPlay(ids[0], "AG1", "p1", now.Add(-time.Hour), "real")
	insertPlay(ids[0], "AG2", "p2", now.Add(-time.Hour), "real")
	insertPlay(ids[1], "AG1", "p3", now.Add(-2*time.Hour), "real")
	insertPlay(ids[1], "AG2", "p4", now.Add(-2*time.Hour), "real")
	insertPlay(ids[2], "AG1", "p5", now.Add(-3*time.Hour), "real")
	insertPlay(ids[2], "AG3", "p6", now.Add(-3*time.Hour), "real")
	insertPlay(ids[2], "AG4", "experience-p7", now.Add(-3*time.Hour), "experience")
	// This user has no favorites, so the favorites scene must fall back to
	// this user's own recent play history.
	insertPlay(ids[3], "AG5", "p8", now.Add(-time.Hour), "real")
	insertPlay(ids[3], "AG6", "p9", now.Add(-2*time.Hour), "real")

	recommendations := &RecommendationModel{DB: db}
	if err := recommendations.Rebuild(ctx, now); err != nil {
		t.Fatal(err)
	}
	rows, err := recommendations.List(ctx, ids[0], "favorites", "*")
	if err != nil || len(rows) != 2 || rows[0].GameID != "AG3" || rows[1].GameID != "AG4" {
		t.Fatalf("favorites recommendations: %#v, %v", rows, err)
	}
	rows, err = recommendations.List(ctx, ids[0], "game_play", "AG1")
	if err != nil || len(rows) != 2 || rows[0].GameID != "AG2" || rows[1].GameID != "AG3" {
		t.Fatalf("play recommendations: %#v, %v", rows, err)
	}
	for _, row := range rows {
		if row.GameID == "AG4" {
			t.Fatal("experience play was included")
		}
	}
	rows, err = recommendations.List(ctx, ids[3], "favorites", "*")
	if err != nil || len(rows) != 2 {
		t.Fatalf("own-play fallback recommendations: %#v, %v", rows, err)
	}
	// This user has no recent activity at all, so the global real-user play
	// ranking is the final fallback.
	rows, err = recommendations.List(ctx, ids[4], "favorites", "*")
	if err != nil || len(rows) == 0 {
		t.Fatalf("global fallback recommendations: %#v, %v", rows, err)
	}
}
