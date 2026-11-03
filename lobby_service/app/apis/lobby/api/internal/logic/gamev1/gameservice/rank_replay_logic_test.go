package gameservice

import (
	"apps/app/apis/lobby/api/internal/config"
	pb "apps/pb/apis/lobby/api/v1"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
)

func TestRankReplayBindsPublicOrderToServerOwnedGameBet(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.URL.Path != "/internal/rank-replay" || r.Header.Get("Authorization") != "Bearer "+strings.Repeat("x", 32) {
			t.Error("adapter auth")
		}
		var in struct {
			UID           int64
			GameID, BetID string
		}
		if json.NewDecoder(r.Body).Decode(&in) != nil || in.UID != 7 || in.GameID != "AG1" || in.BetID != "bet" {
			t.Error("unbound replay", in)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"data": map[string]string{"betId": "bet", "shareToken": strings.Repeat("s", 52)}})
	}))
	defer server.Close()
	l := &Logic{store: &statsFake{}, users: recordUsers{}, config: config.GameConfig{ServiceToken: strings.Repeat("x", 32), Games: map[string]config.GameEntry{"AG1": {URL: "http://game.example/", APIURL: server.URL}}}}
	r := &pb.GameRankReplayRequest{Uid: 7, Sid: strings.Repeat("s", 52), GameId: "AG1", Board: "wins", Period: "today", PlatformOrderId: "123"}
	out, err := l.GameRankReplay(context.Background(), r)
	if err != nil {
		t.Fatal(err)
	}
	u, _ := url.Parse(out.ReplayUrl)
	if u.Query().Get("replay") != "bet" || len(u.Query().Get("share")) != 52 || u.Query().Get("launchTicket") != "" {
		t.Fatal(out)
	}
	r.PlatformOrderId = "124"
	if _, err = l.GameRankReplay(context.Background(), r); err == nil {
		t.Fatal("unranked order accepted")
	}
	r.PlatformOrderId = "123"
	r.Board = "streak"
	if _, err = l.GameRankReplay(context.Background(), r); err == nil {
		t.Fatal("streak accepted")
	}
	r.Board = "multiplier"
	r.Sid = ""
	if _, err = l.GameRankReplay(context.Background(), r); err == nil {
		t.Fatal("anonymous accepted")
	}
	if calls != 1 {
		t.Fatal("rejected request reached game", calls)
	}
}
