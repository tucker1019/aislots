package adminconfig

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"

	"apps/app/apis/lobby/api/internal/adminauth"
	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/model"
	migrations "apps/deploy/migration"

	"github.com/jackc/pgx/v5"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func isolatedConfigDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("LOBBY_INTEGRATION_DATABASE_URL")
	if dsn == "" {
		t.Skip("LOBBY_INTEGRATION_DATABASE_URL required")
	}
	p, e := pgx.ParseConfig(dsn)
	if e != nil || p.Database != "aislots_lobby" {
		t.Fatal("isolated lobby DB required")
	}
	base, e := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if e != nil {
		t.Fatal(e)
	}
	schema := "admin_config_test_" + strings.ToLower(rand.Text())
	if e = base.Exec("CREATE SCHEMA " + schema).Error; e != nil {
		t.Fatal(e)
	}
	u, e := url.Parse(dsn)
	if e != nil {
		t.Fatal(e)
	}
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
	return db
}

func configDefaults(t *testing.T) config.Config {
	t.Helper()
	var c config.Config
	for _, s := range Sections {
		b, e := os.ReadFile("../../../../../../etc/" + s.Key + ".json")
		if e != nil {
			t.Fatal(e)
		}
		if e = applyDocument(&c, s.Key, b); e != nil {
			t.Fatal(e)
		}
	}
	return c
}

func TestConfigHTTPPublishedSnapshotAndPermissions(t *testing.T) {
	db := isolatedConfigDB(t)
	ctx := context.Background()
	c := configDefaults(t)
	// Experience is the one runtime-only document not carried by config.Config.
	experience, e := os.CreateTemp(t.TempDir(), "experience-*.json")
	if e != nil {
		t.Fatal(e)
	}
	if _, e = experience.WriteString(`{"enabled":false,"createMinSeconds":1,"createMaxSeconds":2,"playMinSeconds":1,"playMaxSeconds":2}`); e != nil {
		t.Fatal(e)
	}
	experience.Close()
	t.Setenv("LOBBY_EXPERIENCE_CONFIG", experience.Name())
	if e = Seed(ctx, db, c); e != nil {
		t.Fatal(e)
	}
	if e = adminauth.Bootstrap(db, "config-admin", "isolated-test-password"); e != nil {
		t.Fatal(e)
	}
	const origin = "http://127.0.0.1:5176"
	auth := adminauth.New(db, []string{origin}, false)
	mux := http.NewServeMux()
	auth.Register(mux)
	Register(mux, db, auth.Protect, auth.Actor)
	call := func(method, path, body string, cookie *http.Cookie) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		r.Header.Set("Origin", origin)
		r.Header.Set("X-Admin-Request", "1")
		if cookie != nil {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		return w
	}
	if w := call("GET", "/admin/api/configs", "", nil); w.Code != 401 {
		t.Fatalf("unauth: %d", w.Code)
	}
	login := call("POST", "/admin/api/login", `{"username":"config-admin","password":"isolated-test-password"}`, nil)
	if login.Code != 200 {
		t.Fatal(login.Body.String())
	}
	cookie := login.Result().Cookies()[0]
	list := call("GET", "/admin/api/configs", "", cookie)
	if list.Code != 200 || !bytes.Contains(list.Body.Bytes(), []byte(`"hasDraft":false`)) {
		t.Fatal(list.Body.String())
	}
	// Exercise the actual save route, not only the game configuration loader.
	catalog := c.Game
	catalog.Games = make(map[string]config.GameEntry, len(c.Game.Games))
	for id, entry := range c.Game.Games {
		catalog.Games[id] = entry
	}
	entry := catalog.Games["AG1"]
	rtp := 97.03
	entry.TheoreticalRtp = &rtp
	catalog.Games["AG1"] = entry
	metricDoc, err := json.Marshal(catalog)
	if err != nil {
		t.Fatal(err)
	}
	metricDraft := call("POST", "/admin/api/configs/games/draft", fmt.Sprintf(`{"document":%s,"expectedVersion":1,"reason":"小数RTP保存测试"}`, metricDoc), cookie)
	if metricDraft.Code != 200 || !bytes.Contains(metricDraft.Body.Bytes(), []byte(`97.03`)) {
		t.Fatalf("decimal RTP save: %d %s", metricDraft.Code, metricDraft.Body.String())
	}
	tiers := append([]config.RechargeTier(nil), c.RechargeTiers...)
	tiers[0].Amount += 100
	b, _ := json.Marshal(tiers)
	draft := fmt.Sprintf(`{"document":%s,"expectedVersion":1,"reason":"测试修改"}`, b)
	w := call("POST", "/admin/api/configs/recharge/draft", draft, cookie)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if w = call("POST", "/admin/api/configs/recharge/draft", draft, cookie); w.Code != 409 {
		t.Fatalf("stale draft %d %s", w.Code, w.Body.String())
	}
	before, rev, e := LoadSnapshot(ctx, db, c)
	if e != nil || rev != 0 || before.RechargeTiers[0].Amount != c.RechargeTiers[0].Amount {
		t.Fatal("draft affected runtime", e)
	}
	publish := `{"expectedVersion":2,"reason":"测试发布","requestId":"config-request-test-1"}`
	if w = call("POST", "/admin/api/configs/recharge/publish", publish, cookie); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	after, rev, e := LoadSnapshot(ctx, db, c)
	if e != nil || rev == 0 || after.RechargeTiers[0].Amount != tiers[0].Amount {
		t.Fatal("published snapshot missing", e)
	}
	if e = Seed(ctx, db, c); e != nil {
		t.Fatal(e)
	}
	after, _, e = LoadSnapshot(ctx, db, c)
	if e != nil || after.RechargeTiers[0].Amount != tiers[0].Amount {
		t.Fatal("restart reset publication")
	}
	if w = call("POST", "/admin/api/configs/recharge/rollback", `{"version":1,"expectedVersion":2,"reason":"恢复历史","requestId":"config-request-test-2"}`, cookie); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	row, e := (model.AdminConfigStore{DB: db}).Get(ctx, "recharge", false)
	if e != nil || row.PublishedVersion != 3 {
		t.Fatal(row, e)
	}
	if e = db.Exec("UPDATE lobby_admin_users SET role='viewer' WHERE username='config-admin'").Error; e != nil {
		t.Fatal(e)
	}
	if w = call("POST", "/admin/api/configs/recharge/validate", fmt.Sprintf(`{"document":%s}`, b), cookie); w.Code != 403 {
		t.Fatal("viewer write accepted", w.Code)
	}
	if w = call("GET", "/admin/api/configs/recharge", "", cookie); w.Code != 200 {
		t.Fatal("viewer read rejected", w.Code)
	}
}

func TestSplitLossSectionPreservesLegacyPublishedRateAndDraft(t *testing.T) {
	t.Setenv("LOBBY_EXPERIENCE_CONFIG", "../../../../../../etc/experience.json")
	db := isolatedConfigDB(t)
	ctx := context.Background()
	c := configDefaults(t)
	store := model.AdminConfigStore{DB: db}
	calendar, err := json.Marshal(c.Checkin)
	if err != nil {
		t.Fatal(err)
	}
	if e := store.Seed(ctx, "checkin", calendar); e != nil {
		t.Fatal(e)
	}
	legacy := json.RawMessage(`{"dailyRateBps":80,"weeklyRateBps":10,"monthlyRateBps":10,"loserReturnRateBps":777}`)
	if e := store.Seed(ctx, "returns", legacy); e != nil {
		t.Fatal(e)
	}
	if e := store.Draft(ctx, "returns", 1, json.RawMessage(`{"dailyRateBps":90,"weeklyRateBps":20,"monthlyRateBps":30,"loserReturnRateBps":999}`), "operator", "pending"); e != nil {
		t.Fatal(e)
	}
	if e := Seed(ctx, db, c); e != nil {
		t.Fatal(e)
	}
	row, e := store.Get(ctx, "loss-return", false)
	if e != nil {
		t.Fatal(e)
	}
	var loss config.LossReturnConfig
	if e = json.Unmarshal(row.Published, &loss); e != nil {
		t.Fatal(e)
	}
	if loss.LoserReturnRateBps != 777 || loss.PlatformFeeRateBps != 1000 || !loss.RewardSources["checkin"] || loss.RewardSources["agentCommission"] || loss.RewardSources["inviteReward"] {
		t.Fatal(loss)
	}
	before, e := store.Get(ctx, "returns", false)
	if e != nil {
		t.Fatal(e)
	}
	if before.PublishedVersion != 1 || before.DraftVersion != 2 {
		t.Fatal(before)
	}
	if e = Seed(ctx, db, c); e != nil {
		t.Fatal(e)
	}
	after, e := store.Get(ctx, "returns", false)
	if e != nil {
		t.Fatal(e)
	}
	if after.Version != before.Version || string(after.Draft) != string(before.Draft) || string(after.Published) != string(before.Published) {
		t.Fatal("restart changed legacy draft")
	}
	runtime, e := LoadPublished(ctx, db, c)
	if e != nil {
		t.Fatal(e)
	}
	if runtime.Returns.LoserReturnRateBps != 777 || runtime.Returns.DailyRateBps != 80 {
		t.Fatal(runtime.Returns)
	}
}
