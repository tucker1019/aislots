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
