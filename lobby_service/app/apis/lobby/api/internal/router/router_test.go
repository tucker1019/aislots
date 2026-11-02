package router

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/repository/model"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository"
	"apps/app/apis/lobby/api/internal/svc"
	users "apps/pkg/xerr"
)

type memory struct {
	uid                      int64
	account, password, token string
	expiry                   time.Time
}

func (m *memory) Create(_ context.Context, a, p, s string, e time.Time) (int64, error) {
	m.uid++
	m.account = a
	m.password = p
	m.token = s
	m.expiry = e
	return m.uid, nil
}

func (m *memory) Renew(_ context.Context, u int64, s string, n, e time.Time) error {
	if u != m.uid || s != m.token || !m.expiry.After(n) {
		return users.ErrSession
	}
	m.expiry = e
	return nil
}

func (m *memory) Credentials(_ context.Context, a string) (int64, string, error) {
	if a != m.account {
		return 0, "", users.ErrCredentials
	}
	return m.uid, m.password, nil
}

func (m *memory) NewSession(_ context.Context, u int64, s string, e time.Time) error {
	m.token = s
	m.expiry = e
	return nil
}

func (m *memory) Bind(_ context.Context, u int64, s, a, p string, n, e time.Time) error {
	if u != m.uid || s != m.token || !m.expiry.After(n) {
		return users.ErrSession
	}
	if m.account != "" {
		return users.ErrExists
	}
	m.account = a
	m.password = p
	m.expiry = e
	return nil
}

func TestUserLifecycle(t *testing.T) {
	store := &memory{}
	handler := New(svc.New(config.Config{SessionDays: 60}, &repository.Repository{Users: store}))
	call := func(path, body string, want int) struct {
		UID       int64     `json:"uid"`
		SID       string    `json:"sid"`
		ExpiresAt time.Time `json:"expiresAt"`
	} {
		t.Helper()
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, httptest.NewRequest("POST", "/api/user/account/"+path, strings.NewReader(body)))
		if w.Code != want {
			t.Fatalf("%s: %d %s", path, w.Code, w.Body.String())
		}
		var response struct {
			Data struct {
				UID       int64     `json:"uid"`
				SID       string    `json:"sid"`
				ExpiresAt time.Time `json:"expiresAt"`
			} `json:"data"`
		}
		if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
			t.Fatal(err)
		}
		return response.Data
	}
	visitor := call("visitor/login?app_name=lobby&uuid=device", "{}", 200)
	if len(visitor.SID) != 52 || store.token == visitor.SID {
		t.Fatal("sid must be random and stored hashed")
	}
	identity := `"uid":1,"sid":"` + visitor.SID + `"`
	store.expiry = time.Now().Add(time.Hour)
	renewed := call("session/renewal", "{"+identity+"}", 200)
	if time.Until(renewed.ExpiresAt) < 59*24*time.Hour {
		t.Fatal("session not renewed")
	}
	call("session/renewal?uid=2", "{"+identity+"}", 400)
	call("uniquecode/bind", "{"+identity+`,"account":"alice","password":"password123"}`, 200)
	if store.password == "password123" {
		t.Fatal("plaintext password")
	}
	call("uniquecode/login", "{"+identity+`,"account":"alice","password":"incorrect"}`, 401)
	login := call("uniquecode/login", "{"+identity+`,"account":"alice","password":"password123"}`, 200)
	if login.UID != visitor.UID || login.SID == visitor.SID {
		t.Fatal("login identity incorrect")
	}
	store.expiry = time.Now().Add(-time.Second)
	call("session/renewal", `{"uid":1,"sid":"`+login.SID+`"}`, 401)
	call("uniquecode/register", `{"account":"bob","password":"password456"}`, 200)
	call("uniquecode/register", `{"account":"b","password":"short"}`, 400)
}

func (m *memory) Check(ctx context.Context, u int64, s string, n time.Time) error {
	if u != m.uid || s != m.token || !m.expiry.After(n) {
		return users.ErrSession
	}
	return nil
}

func (m *memory) Profile(ctx context.Context, u int64, s string, n time.Time) (*model.Profile, error) {
	if err := m.Check(ctx, u, s, n); err != nil {
		return nil, err
	}
	return &model.Profile{UID: u, Nickname: "player_1", AvatarID: 1}, nil
}

func (m *memory) UpdateProfile(ctx context.Context, u int64, s string, n time.Time, name *string, avatar *int32) (*model.Profile, error) {
	p, err := m.Profile(ctx, u, s, n)
	if err != nil {
		return nil, err
	}
	if name != nil {
		p.Nickname = *name
	}
	if avatar != nil {
		p.AvatarID = *avatar
	}
	return p, nil
}
