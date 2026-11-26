package j7

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAmountConversion(t *testing.T) {
	if got, ok := amountToMinor(-10.25); !ok || got != -1025 {
		t.Fatalf("expected -1025, got %d (%v)", got, ok)
	}
	if got, ok := amountToMinor(25.5); !ok || got != 2550 {
		t.Fatalf("expected 2550, got %d (%v)", got, ok)
	}
	if _, ok := amountToMinor(0); ok {
		t.Fatalf("expected 0 to be rejected")
	}
	if got := coinsToFloat(100050); got != 1000.5 {
		t.Fatalf("expected 1000.5, got %v", got)
	}
}

func TestHandlerAuthFailure(t *testing.T) {
	h := &Handler{
		Config: Config{AppID: "app_1", AppSecret: "secret_1"},
	}
	mux := http.NewServeMux()
	h.Register(mux, "/api/thirdparty/j7")

	req := httptest.NewRequest(http.MethodPost, "/api/thirdparty/j7/Cash/Get", bytes.NewBufferString(`{"UserID":"10000001","AppID":"wrong","AppSecret":"secret_1"}`))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	var body struct {
		Code  int    `json:"code"`
		Error string `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Code != 1 || body.Error != "auth failed" {
		t.Fatalf("expected auth failed, got %+v", body)
	}
}

func TestClientLaunchAndCategories(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/homeGameCategory":
			_ = json.NewEncoder(w).Encode(map[string]any{
				"code":    200,
				"message": "success",
				"data": []map[string]any{
					{
						"config": map[string]any{"title": "JILI"},
						"game": []map[string]any{
							{"game_code": "10049", "game_name": "Super Ace", "icon": "https://520.imgix.net/game/ag/10049.webp"},
						},
					},
				},
			})
		case "/api/v1/game/launch":
			if r.Header.Get("AppID") != "app_1" || r.Header.Get("AppSecret") != "secret_1" {
				w.WriteHeader(http.StatusUnauthorized)
				return
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"error": "",
				"data":  map[string]any{"Url": "https://game.example.com/play?token=abc"},
			})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	client := NewClient(Config{
		AppID:       "app_1",
		AppSecret:   "secret_1",
		GameAPIURL:  srv.URL,
		GameListURL: srv.URL + "/api/homeGameCategory",
		Language:    "en",
		Currency:    "$",
	})
	cats, err := client.FetchGameCategories(context.Background())
	if err != nil || len(cats) != 1 || cats[0].Config.Title != "JILI" || len(cats[0].Game) != 1 {
		t.Fatalf("unexpected categories: %+v, err=%v", cats, err)
	}
	launchURL, err := client.LaunchGame(context.Background(), "10000001", "10049", "", "")
	if err != nil || launchURL != "https://game.example.com/play?token=abc" {
		t.Fatalf("unexpected launchURL: %q, err=%v", launchURL, err)
	}
}
