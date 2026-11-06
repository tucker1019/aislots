package adminauth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type Identity struct {
	Username string `json:"username"`
	Role     string `json:"role"`
}
type key struct{}
type Auth struct {
	DB       *gorm.DB
	Origins  map[string]bool
	Secure   bool
	mu       sync.Mutex
	attempts map[string][]time.Time
}

func New(db *gorm.DB, origins []string, secure bool) *Auth {
	a := &Auth{DB: db, Origins: map[string]bool{}, Secure: secure, attempts: map[string][]time.Time{}}
	for _, o := range origins {
		a.Origins[strings.TrimSpace(o)] = true
	}
	return a
}
func Actor(r *http.Request) string { v, _ := r.Context().Value(key{}).(Identity); return v.Username }
func Reply(w http.ResponseWriter, status int, code string, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	if status >= 400 {
		_ = json.NewEncoder(w).Encode(map[string]any{"code": code, "message": code})
	} else {
		_ = json.NewEncoder(w).Encode(map[string]any{"code": "OK", "data": data})
	}
}
func hash(s string) string { v := sha256.Sum256([]byte(s)); return hex.EncodeToString(v[:]) }
func (a *Auth) Allowed(r *http.Request) bool {
	o := r.Header.Get("Origin")
	return o != "" && a.Origins[o]
}
func (a *Auth) Protect(permission string, h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" && (!a.Allowed(r) || r.Header.Get("X-Admin-Request") != "1") {
			Reply(w, 403, "FORBIDDEN", nil)
			return
		}
		c, e := r.Cookie("lobby_admin")
		if e != nil {
			Reply(w, 401, "UNAUTHORIZED", nil)
			return
		}
		var v Identity
		e = a.DB.WithContext(r.Context()).Raw(`SELECT u.username,u.role FROM lobby_admin_sessions s JOIN lobby_admin_users u USING(username) WHERE s.token_hash=? AND s.expires_at>? AND NOT u.disabled`, hash(c.Value), time.Now()).Scan(&v).Error
		if e != nil || v.Username == "" {
			Reply(w, 401, "UNAUTHORIZED", nil)
			return
		}
		allowed := v.Role == "admin" || strings.HasSuffix(permission, ".read") || (permission == "configs.write" && v.Role == "operator") || (permission == "orders.review" && v.Role == "finance")
		if !allowed {
			Reply(w, 403, "FORBIDDEN", nil)
			return
		}
		h(w, r.WithContext(context.WithValue(r.Context(), key{}, v)))
	}
}
func (a *Auth) Register(m *http.ServeMux) {
	m.HandleFunc("POST /admin/api/login", a.login)
	m.HandleFunc("GET /admin/api/me", a.Protect("auth.read", func(w http.ResponseWriter, r *http.Request) { Reply(w, 200, "", r.Context().Value(key{})) }))
	m.HandleFunc("POST /admin/api/logout", a.Protect("auth.read", func(w http.ResponseWriter, r *http.Request) {
		c, _ := r.Cookie("lobby_admin")
		if e := a.DB.Exec("DELETE FROM lobby_admin_sessions WHERE token_hash=?", hash(c.Value)).Error; e != nil {
			Reply(w, 500, "INTERNAL", nil)
			return
		}
		http.SetCookie(w, &http.Cookie{Name: "lobby_admin", Value: "", Path: "/admin/api", HttpOnly: true, Secure: a.Secure, SameSite: http.SameSiteStrictMode, MaxAge: -1})
		Reply(w, 200, "", map[string]any{})
	}))
}
func (a *Auth) login(w http.ResponseWriter, r *http.Request) {
	if !a.Allowed(r) || r.Header.Get("X-Admin-Request") != "1" {
		Reply(w, 403, "FORBIDDEN", nil)
		return
	}
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	now := time.Now()
	a.mu.Lock()
	if len(a.attempts) > 4096 {
		for address, times := range a.attempts {
			if len(times) == 0 || now.Sub(times[len(times)-1]) >= 15*time.Minute {
				delete(a.attempts, address)
			}
		}
	}
	if _, exists := a.attempts[ip]; !exists && len(a.attempts) > 4096 {
		a.mu.Unlock()
		Reply(w, 429, "RATE_LIMITED", nil)
		return
	}
	xs := a.attempts[ip]
	kept := xs[:0]
	for _, t := range xs {
		if now.Sub(t) < 15*time.Minute {
			kept = append(kept, t)
		}
	}
	limited := len(kept) >= 10
	if !limited {
		kept = append(kept, now)
	}
	a.attempts[ip] = kept
	a.mu.Unlock()
	if limited {
		Reply(w, 429, "RATE_LIMITED", nil)
		return
	}
	var b struct{ Username, Password string }
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&b) != nil || len(b.Password) > 72 || len(b.Username) > 64 {
		Reply(w, 400, "INVALID", nil)
		return
	}
	var u struct{ Username, Role, PasswordHash string }
	e := a.DB.Table("lobby_admin_users").Where("username=? AND NOT disabled", b.Username).Take(&u).Error
	if e != nil || bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(b.Password)) != nil {
		Reply(w, 401, "UNAUTHORIZED", nil)
		return
	}
	token := rand.Text() + rand.Text()
	e = a.DB.Exec("INSERT INTO lobby_admin_sessions(token_hash,username,expires_at) VALUES(?,?,?)", hash(token), u.Username, now.Add(8*time.Hour)).Error
	if e != nil {
		Reply(w, 500, "INTERNAL", nil)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "lobby_admin", Value: token, Path: "/admin/api", HttpOnly: true, Secure: a.Secure, SameSite: http.SameSiteStrictMode, MaxAge: 28800})
	Reply(w, 200, "", Identity{u.Username, u.Role})
}
func Bootstrap(db *gorm.DB, username, password string) error {
	if len(username) < 3 || len(username) > 64 || len(password) < 14 || len(password) > 72 {
		return errors.New("username 3-64 chars and password 14-72 bytes required")
	}
	h, e := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if e != nil {
		return e
	}
	return db.Exec("INSERT INTO lobby_admin_users(username,password_hash,role) VALUES(?,?,'admin')", username, string(h)).Error
}
func (a *Auth) Actor(r *http.Request) string { return Actor(r) }
