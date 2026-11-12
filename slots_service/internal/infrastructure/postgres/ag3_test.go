package postgres_test

import (
	"aislots/slots_service/internal/application/betlist"
	"aislots/slots_service/internal/application/play"
	"aislots/slots_service/internal/bootstrap"
	"aislots/slots_service/internal/infrastructure/gamedata"
	"context"
	"reflect"
	"testing"
)

// The DB helper isolates its schema; this engine uses only the test wallet.
func TestAG3ActualLibraryProgressiveWagerAndPreview(t *testing.T) {
	store, _ := database(t)
	config, err := bootstrap.LoadConfig("../../../configs/server.test.json")
	if err != nil {
		t.Fatal(err)
	}
	catalog, err := bootstrap.LoadCatalog(config)
	if err != nil {
		t.Fatal(err)
	}
	defer catalog.Close()
	raw, err := gamedata.LoadBetPolicies(config.BetPoliciesFile)
	if err != nil {
		t.Fatal(err)
	}
	policies, err := betlist.New(raw)
	if err != nil {
		t.Fatal(err)
	}
	s, err := play.New(store, catalog, policies, profile())
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	auth, err := s.Login(ctx, play.LoginRequest{Test: true, AppName: profile().AppName, AppKey: profile().AppKey, UID: profile().UID, GameID: "AG3"})
	if err != nil {
		t.Fatal(err)
	}
	session, err := s.Authenticate(ctx, auth.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	status, err := s.Status(ctx, session, "AG3")
	if err != nil {
		t.Fatal(err)
	}
	first, err := s.Spin(ctx, session, "AG3", status.RequestID, 200)
	if err != nil {
		t.Fatal(err)
	}
	repeated, err := s.Spin(ctx, session, "AG3", status.RequestID, 200)
	if err != nil || !reflect.DeepEqual(first, repeated) {
		t.Fatal("wager retry changed frame", err)
	}
	frame := first
	for n := 0; ; n++ {
		if n > 1000 {
			t.Fatal("AG3 round did not complete")
		}
		if frame.PreviewRows != 1 || len(frame.Board) != 6 {
			t.Fatalf("missing AG3 six-column preview: %+v", frame)
		}
		for col, height := range []int{3, 4, 5, 5, 4, 3} {
			if len(frame.Board[col]) != height+1 {
				t.Fatalf("wrong display column %d: %d", col, len(frame.Board[col]))
			}
		}
		if frame.NextAction == "complete" {
			break
		}
		frame, err = s.Spin(ctx, session, "AG3", frame.NextRequestID, 200)
		if err != nil {
			t.Fatal(err)
		}
	}
	replay, err := s.BetReplay(ctx, session, "AG3", first.BetID, 100, "")
	if err != nil || len(replay.Frames) == 0 {
		t.Fatal("missing AG3 wager replay", err)
	}
	if _, err = s.BetReplay(ctx, session, "AG2", first.BetID, 100, ""); err == nil {
		t.Fatal("AG3 history leaked into AG2")
	}
}
