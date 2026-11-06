package adminapi

import (
	"apps/app/apis/lobby/api/internal/repository/model"
	migrations "apps/deploy/migration"
	"context"
	"crypto/rand"
	"github.com/jackc/pgx/v5"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"
)

func testDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("LOBBY_INTEGRATION_DATABASE_URL")
	if dsn == "" {
		t.Skip("integration database not set")
	}
	c, e := pgx.ParseConfig(dsn)
	if e != nil || c.Database != "aislots_lobby" {
		t.Fatal("isolated lobby database required")
	}
	base, e := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if e != nil {
		t.Fatal(e)
	}
	schema := "admin_api_" + strings.ToLower(rand.Text())
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
		sqlDB, _ := db.DB()
		sqlDB.Close()
		base.Exec("DROP SCHEMA " + schema + " CASCADE")
		sqlBase, _ := base.DB()
		sqlBase.Close()
	})
	if e = db.Exec(migrations.Schema).Error; e != nil {
		t.Fatal(e)
	}
	return db
}
func TestAdminReadEndpoints(t *testing.T) {
	db := testDB(t)
	uid, e := (&model.UserModel{DB: db}).Create(context.Background(), "", "", "api-read-test", time.Now().Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	if e = (&model.WalletAccountModel{DB: db}).SaveAccount(context.Background(), uid, "test1", "secret-account-number", "secret-person-name"); e != nil {
		t.Fatal(e)
	}
	a := &API{DB: db}
	cases := []struct {
		url     string
		handler func(*httptest.ResponseRecorder)
	}{{"/admin/api/overview", func(w *httptest.ResponseRecorder) {
		a.overview(w, httptest.NewRequest("GET", "/admin/api/overview", nil))
	}}, {"/admin/api/members", func(w *httptest.ResponseRecorder) {
		a.members(w, httptest.NewRequest("GET", "/admin/api/members", nil))
	}}, {"/admin/api/orders", func(w *httptest.ResponseRecorder) {
		a.orders(w, httptest.NewRequest("GET", "/admin/api/orders?kind=deposit", nil))
	}}, {"/admin/api/audit", func(w *httptest.ResponseRecorder) { a.audit(w, httptest.NewRequest("GET", "/admin/api/audit", nil)) }}}
	for _, tc := range cases {
		t.Run(tc.url, func(t *testing.T) {
			w := httptest.NewRecorder()
			tc.handler(w)
			if w.Code != 200 {
				t.Fatalf("%d %s", w.Code, w.Body.String())
			}
			if strings.Contains(w.Body.String(), "password") || strings.Contains(w.Body.String(), "sid_hash") {
				t.Fatal("credential disclosure")
			}
		})
	}
	r := httptest.NewRequest("GET", "/admin/api/members/1", nil)
	var id string
	db.Raw("SELECT uid::text FROM lobby_users LIMIT 1").Scan(&id)
	r.SetPathValue("uid", id)
	w := httptest.NewRecorder()
	a.member(w, r)
	if w.Code != 200 {
		t.Fatalf("detail %d %s", w.Code, w.Body.String())
	}
	if strings.Contains(w.Body.String(), "secret-account-number") || strings.Contains(w.Body.String(), "secret-person-name") {
		t.Fatal("payout identity disclosure")
	}
}
