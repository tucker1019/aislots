package server

import (
	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/model"
	migrations "apps/deploy/migration"
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"
)

func experienceTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("LOBBY_INTEGRATION_DATABASE_URL")
	if dsn == "" {
		t.Skip("LOBBY_INTEGRATION_DATABASE_URL required")
	}
	u, err := url.Parse(dsn)
	if err != nil || strings.TrimPrefix(u.Path, "/") != "aislots_lobby" {
		t.Fatal("dedicated lobby DB required")
	}
	root, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	schema := "exp_test_" + strings.ToLower(rand.Text())
	if err = root.Exec("CREATE SCHEMA " + schema).Error; err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	q.Set("search_path", schema)
	u.RawQuery = q.Encode()
	db, err := gorm.Open(postgres.Open(u.String()), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		sql, _ := db.DB()
		_ = sql.Close()
		_ = root.Exec("DROP SCHEMA " + schema + " CASCADE").Error
		sql, _ = root.DB()
		_ = sql.Close()
	})
	if err = db.Exec(migrations.Schema).Error; err != nil {
		t.Fatal(err)
	}
	return db
}
func TestExperienceDispatchBindsGamesRecoversPendingAndUsesStopConfig(t *testing.T) {
	db := experienceTestDB(t)
	ctx := context.Background()
	m := model.ExperienceModel{DB: db}
	now := time.Now().Add(time.Second)
	for i, id := range []string{"AG1", "AG2"} {
		if err := m.CreateScheduled(ctx, now.Add(time.Duration(i)*time.Minute), 100000, 10, 1, id, "ID", "IDR", time.Second); err != nil {
			t.Fatal(err)
		}
	}
	if err := db.Exec("UPDATE lobby_experience_accounts SET next_at=?", time.Now().Add(-time.Second)).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec("UPDATE lobby_experience_schedule SET next_create_at=?", now.Add(time.Hour)).Error; err != nil {
		t.Fatal(err)
	}
	var mu sync.Mutex
	failed := false
	ids := map[string][]string{}
	policies := map[string]int{}
	api := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		if r.Header.Get("Authorization") != "Bearer "+strings.Repeat("s", 32) {
			t.Error("missing service authentication")
			w.WriteHeader(401)
			return
		}
		var in struct {
			GameID    string
			RequestID string
			UID       int64
		}
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			t.Error(err)
			return
		}
		if in.GameID != "AG1" && in.GameID != "AG2" {
			t.Error("wrong game", in.GameID)
			w.WriteHeader(400)
			return
		}
		var data any
		if r.URL.Path == "/internal/auto-bets" {
			policies[in.GameID]++
			lines := 20
			if in.GameID == "AG2" {
				lines = 25
			}
			data = map[string]any{"amounts": []int64{10}, "lineCount": lines, "betLevel": 2}
		} else if r.URL.Path == "/internal/auto-round" {
			ids[in.GameID] = append(ids[in.GameID], in.RequestID)
			if in.GameID == "AG1" && !failed {
				failed = true
				w.WriteHeader(503)
				return
			}
			data = map[string]any{"status": "complete", "requestID": in.RequestID, "betID": fmt.Sprintf("bet-%d", in.UID)}
		} else {
			t.Error("unexpected path", r.URL.Path)
			w.WriteHeader(404)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"code": "OK", "data": data})
	}))
	defer api.Close()
	c := config.Config{Game: config.GameConfig{Country: "ID", Currency: "IDR", ServiceToken: strings.Repeat("s", 32), Games: map[string]config.GameEntry{"AG1": {Enabled: true, APIURL: api.URL}, "AG2": {Enabled: true, APIURL: api.URL}}}}
	every, chance := 1, 100
	cfg := config.ExperienceConfig{Enabled: true, CreateMinSeconds: 30, CreateMaxSeconds: 30, PlayMinSeconds: 1, PlayMaxSeconds: 1, GameWeights: map[string]int64{"AG1": 0, "AG2": 0}, StopEveryRounds: &every, StopChancePercent: &chance}
	if err := dispatchExperience(ctx, c, cfg, db, nil); err != nil {
		t.Fatal(err)
	}
	pending, err := m.DueJobs(ctx, false, time.Now())
	if err != nil || len(pending) != 1 || pending[0].GameID != "AG1" {
		t.Fatal(pending, err)
	}
	game := c.Game.Games["AG1"]
	game.Enabled = false
	c.Game.Games["AG1"] = game
	if err = dispatchExperience(ctx, c, cfg, db, nil); err != nil {
		t.Fatal(err)
	}
	mu.Lock()
	if len(ids["AG1"]) != 2 || ids["AG1"][0] != ids["AG1"][1] || len(ids["AG2"]) != 1 || policies["AG1"] != 1 || policies["AG2"] != 1 {
		t.Fatal("wrong routing or retry", ids, policies)
	}
	mu.Unlock()
	var stopped int64
	if err = db.Table("lobby_experience_accounts").Where("stopped AND rounds=1").Count(&stopped).Error; err != nil || stopped != 2 {
		t.Fatal("stop settings ignored", stopped, err)
	}
	cfg.GameWeights = map[string]int64{"AG2": 1}
	if err = db.Exec("UPDATE lobby_experience_schedule SET next_create_at=?", now.Add(-time.Minute)).Error; err != nil {
		t.Fatal(err)
	}
	if err = dispatchExperience(ctx, c, cfg, db, nil); err != nil {
		t.Fatal(err)
	}
	var ag2 int64
	if err = db.Table("lobby_experience_accounts").Where("game_id='AG2'").Count(&ag2).Error; err != nil || ag2 != 2 {
		t.Fatal("new account not assigned by weights", ag2, err)
	}
	game = c.Game.Games["AG2"]
	game.Enabled = false
	c.Game.Games["AG2"] = game
	if err = db.Exec("UPDATE lobby_experience_schedule SET next_create_at=?", now.Add(-time.Minute)).Error; err != nil {
		t.Fatal(err)
	}
	if err = dispatchExperience(ctx, c, cfg, db, nil); err != nil {
		t.Fatal(err)
	}
	var count int64
	if err = db.Table("lobby_experience_accounts").Count(&count).Error; err != nil || count != 3 {
		t.Fatal("offline game created an account", count, err)
	}
}
