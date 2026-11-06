package server

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"net/http/httptest"
	"net/url"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	users "apps/app/apis/lobby/api/internal/logic/userv1/userservice"
	"apps/app/apis/lobby/api/internal/repository/model"
	migrations "apps/deploy/migration"
	"github.com/jackc/pgx/v5"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestRuntimeAppliesPublishedConfigWithoutRestart(t *testing.T) {
	dsn := os.Getenv("LOBBY_INTEGRATION_DATABASE_URL")
	if dsn == "" {
		t.Skip("LOBBY_INTEGRATION_DATABASE_URL required")
	}
	parsed, e := pgx.ParseConfig(dsn)
	if e != nil || parsed.Database != "aislots_lobby" {
		t.Fatal("dedicated lobby database required")
	}
	base, e := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if e != nil {
		t.Fatal(e)
	}
	schema := "admin_runtime_test_" + strings.ToLower(rand.Text())
	if e = base.Exec("CREATE SCHEMA " + schema).Error; e != nil {
		t.Fatal(e)
	}
	u, _ := url.Parse(dsn)
	q := u.Query()
	q.Set("search_path", schema)
	u.RawQuery = q.Encode()
	db, e := gorm.Open(postgres.Open(u.String()), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() {
		c, _ := db.DB()
		_ = c.Close()
		_ = base.Exec("DROP SCHEMA " + schema + " CASCADE").Error
		b, _ := base.DB()
		_ = b.Close()
	})
	if e = db.Exec(migrations.Schema).Error; e != nil {
		t.Fatal(e)
	}
	path := func(name string) string { return "../../../../../../etc/" + name + ".json" }
	c := config.Config{DatabaseURL: u.String(), SessionDays: 60}
	c.Turnover, e = config.LoadTurnover(path("turnover"))
	if e != nil {
		t.Fatal(e)
	}
	c.Checkin, e = config.LoadCheckin(path("checkin"))
	if e != nil {
		t.Fatal(e)
	}
	c.RechargeTiers, e = config.LoadRechargeTiers(path("recharge"))
	if e != nil {
		t.Fatal(e)
	}
	c.WithdrawalTiers, e = config.LoadRechargeTiers(path("withdrawal"))
	if e != nil {
		t.Fatal(e)
	}
	c.Returns, e = config.LoadReturns(path("returns"))
	if e != nil {
		t.Fatal(e)
	}
	c.VIP, e = config.LoadVIP(path("vip"))
	if e != nil {
		t.Fatal(e)
	}
	c.Agent, e = config.LoadAgent(path("agent"))
	if e != nil {
		t.Fatal(e)
	}
	c.Invite, e = config.LoadInvite(path("invite"))
	if e != nil {
		t.Fatal(e)
	}
	c.Newbie, e = config.LoadNewbie(path("newbie-recharge"))
	if e != nil {
		t.Fatal(e)
	}
	c.Game, e = config.LoadGames(path("games"))
	if e != nil {
		t.Fatal(e)
	}
	c.Content, e = config.LoadContent(path("content"))
	if e != nil {
		t.Fatal(e)
	}
	c.Game.Games = map[string]config.GameEntry{}
	experience := t.TempDir() + "/experience.json"
	if e = os.WriteFile(experience, []byte(`{"enabled":false,"createMinSeconds":1,"createMaxSeconds":2,"playMinSeconds":1,"playMaxSeconds":2}`), 0600); e != nil {
		t.Fatal(e)
	}
	t.Setenv("LOBBY_EXPERIENCE_CONFIG", experience)
	ctx := context.Background()
	live, e := NewRuntime(ctx, db, c)
	if e != nil {
		t.Fatal(e)
	}
	defer live.Close()
	user := &model.UserModel{DB: db}
	token := strings.Repeat("r", 52)
	uid, e := user.Create(ctx, "", "", users.Hash(token), time.Now().Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	query := url.Values{"uid": {strconv.FormatInt(uid, 10)}, "sid": {token}}
	amount := func() int64 {
		w := httptest.NewRecorder()
		live.ServeHTTP(w, httptest.NewRequest("GET", "/api/recharge/list?"+query.Encode(), nil))
		var v struct {
			Data struct {
				Items []struct {
					Amount int64 `json:"amount"`
				} `json:"items"`
			} `json:"data"`
		}
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &v) != nil || len(v.Data.Items) == 0 {
			t.Fatal(w.Code, w.Body.String())
		}
		return v.Data.Items[0].Amount
	}
	old := amount()
	tiers := append([]config.RechargeTier(nil), c.RechargeTiers...)
	tiers[0].Amount += 100
	doc, _ := json.Marshal(tiers)
	store := model.AdminConfigStore{DB: db}
	if e = store.Draft(ctx, "recharge", 1, doc, "test-admin", "runtime draft"); e != nil {
		t.Fatal(e)
	}
	if amount() != old {
		t.Fatal("unpublished draft affected runtime")
	}
	if e = store.Publish(ctx, "recharge", 2, 0, "runtime-publish-test", "fp", "test-admin", "runtime publish", func(_ model.AdminConfigRow, b json.RawMessage, _ int64) (json.RawMessage, error) { return b, nil }); e != nil {
		t.Fatal(e)
	}
	deadline := time.Now().Add(6 * time.Second)
	for amount() != tiers[0].Amount {
		if time.Now().After(deadline) {
			t.Fatal("published config did not become live")
		}
		time.Sleep(30 * time.Millisecond)
	}
	admin := httptest.NewRecorder()
	live.ServeHTTP(admin, httptest.NewRequest("GET", "/admin/api/configs", nil))
	if admin.Code != 404 {
		t.Fatal("admin config exposed on player listener", admin.Code)
	}
}
