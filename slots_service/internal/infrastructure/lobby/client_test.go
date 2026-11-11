package lobby

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestLaunchAllowsConfiguredGamesAndScopesTokens(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var in struct{ GameID string }
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			t.Error(err)
		}
		if in.GameID != "AG1" && in.GameID != "AG2" {
			t.Errorf("unexpected game %q", in.GameID)
		}
		calls++
		_ = json.NewEncoder(w).Encode(map[string]any{"code": "OK", "data": map[string]any{"uid": 123, "appname": "lobby", "appkey": "web", "country": "ID", "currency": "IDR", "coins": 100}})
	}))
	defer server.Close()
	client, err := New(Config{URL: server.URL, AppName: "lobby", AppKey: "web", GameID: "AG1", GameIDs: []string{"AG1", "AG2"}}, strings.Repeat("s", 32))
	if err != nil {
		t.Fatal(err)
	}
	tokens := map[string]bool{}
	for _, game := range []string{"AG1", "AG2"} {
		_, _, token, err := client.VerifyLaunch(context.Background(), strings.Repeat("t", 52), strings.Repeat("e", 16), game)
		if err != nil {
			t.Fatal(err)
		}
		if tokens[token] {
			t.Fatal("games share a token")
		}
		tokens[token] = true
	}
	if _, _, _, err := client.VerifyLaunch(context.Background(), strings.Repeat("t", 52), strings.Repeat("e", 16), "AG3"); err == nil {
		t.Fatal("unknown game accepted")
	}
	if calls != 2 {
		t.Fatalf("unexpected exchange count %d", calls)
	}
}
