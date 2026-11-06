package model

import (
	"apps/app/apis/lobby/api/internal/adminauth"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAdminAuthentication(t *testing.T) {
	db := vipTestDB(t)
	if e := adminauth.Bootstrap(db, "finance-admin", "a-long-test-password-only"); e != nil {
		t.Fatal(e)
	}
	a := adminauth.New(db, []string{"http://localhost:5176"}, false)
	mux := http.NewServeMux()
	a.Register(mux)
	mux.HandleFunc("POST /publish", a.Protect("configs.publish", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) }))
	request := func(path, origin string, cookie *http.Cookie) *httptest.ResponseRecorder {
		r := httptest.NewRequest("POST", path, strings.NewReader(`{"username":"finance-admin","password":"a-long-test-password-only"}`))
		r.Header.Set("Origin", origin)
		r.Header.Set("X-Admin-Request", "1")
		if cookie != nil {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		return w
	}
	if w := request("/admin/api/login", "https://evil.example", nil); w.Code != 403 {
		t.Fatalf("origin %d", w.Code)
	}
	w := request("/admin/api/login", "http://localhost:5176", nil)
	if w.Code != 200 {
		t.Fatalf("login %d %s", w.Code, w.Body.String())
	}
	cookies := w.Result().Cookies()
	if len(cookies) != 1 || !cookies[0].HttpOnly || cookies[0].SameSite != http.SameSiteStrictMode {
		t.Fatal("insecure cookie")
	}
	var stored string
	if e := db.Raw("SELECT token_hash FROM lobby_admin_sessions").Scan(&stored).Error; e != nil {
		t.Fatal(e)
	}
	if stored == cookies[0].Value || len(stored) != 64 {
		t.Fatal("raw session stored")
	}
	if e := db.Exec("UPDATE lobby_admin_users SET role='viewer'").Error; e != nil {
		t.Fatal(e)
	}
	if w = request("/publish", "http://localhost:5176", cookies[0]); w.Code != 403 {
		t.Fatalf("role %d", w.Code)
	}
	r := httptest.NewRequest("GET", "/admin/api/me", nil)
	r.AddCookie(cookies[0])
	w = httptest.NewRecorder()
	mux.ServeHTTP(w, r)
	var out map[string]any
	json.Unmarshal(w.Body.Bytes(), &out)
	if w.Code != 200 || strings.Contains(w.Body.String(), "password") {
		t.Fatalf("me %d", w.Code)
	}
	for range 10 {
		request("/admin/api/login", "http://localhost:5176", nil)
	}
	if w = request("/admin/api/login", "http://localhost:5176", nil); w.Code != 429 {
		t.Fatalf("limit %d", w.Code)
	}
}
