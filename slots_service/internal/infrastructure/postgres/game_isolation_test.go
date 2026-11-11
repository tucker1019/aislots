package postgres_test

import (
	"aislots/slots_service/internal/application/bet"
	"aislots/slots_service/internal/application/betlist"
	"aislots/slots_service/internal/application/play"
	"aislots/slots_service/internal/engine"
	"aislots/slots_service/internal/infrastructure/postgres"
	"context"
	"testing"
)

type independentGames struct{ g *spinner }

func (g independentGames) Resolve(id, version string) (bet.Spinner, error) {
	if (id != "AG1" && id != "AG2") || (version != "" && version != g.g.Version()) {
		return nil, bet.ErrGameUnavailable
	}
	return independentSpinner{g.g, id}, nil
}

type independentSpinner struct {
	*spinner
	id string
}

func (g independentSpinner) Spin(ctx context.Context, r engine.SpinRequest) (engine.SpinResult, error) {
	out, err := g.spinner.Spin(ctx, r)
	out.GameID = g.id
	return out, err
}
func independentService(t *testing.T, store play.Store, g *spinner) *play.Service {
	t.Helper()
	policies, err := betlist.New([]betlist.Policy{
		{GameID: "AG1", Country: "ID", Currency: "IDR", Amounts: []int64{100}, Default: 100},
		{GameID: "AG2", Country: "ID", Currency: "IDR", Amounts: []int64{100}, Default: 100},
	})
	if err != nil {
		t.Fatal(err)
	}
	s, err := play.New(store, independentGames{g}, policies, profile())
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestGamesKeepIndependentOpenBetsAndRecovery(t *testing.T) {
	store, dsn := database(t)
	g := &spinner{}
	s := independentService(t, store, g)
	ctx := context.Background()
	first, _ := login(t, s)
	auth, err := s.Login(ctx, play.LoginRequest{Test: true, AppName: profile().AppName, AppKey: profile().AppKey, UID: profile().UID, GameID: "AG2"})
	if err != nil {
		t.Fatal(err)
	}
	second, err := s.Authenticate(ctx, auth.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	a, err := s.Prepare(ctx, first, "AG1", 100)
	if err != nil {
		t.Fatal(err)
	}
	idle, err := s.Status(ctx, second, "AG2")
	if err != nil || idle.HasNext || idle.LastFrame != nil {
		t.Fatalf("other game's prepared bet blocked entry: %+v %v", idle, err)
	}
	b, err := s.Prepare(ctx, second, "AG2", 100)
	if err != nil {
		t.Fatal("independent preparations", err)
	}
	for _, item := range []struct {
		session play.Session
		id      string
	}{{first, a.BetID}, {second, b.BetID}} {
		recovered, err := s.Recover(ctx, item.session, item.session.GameID)
		if err != nil || recovered.BetID != item.id || recovered.Status != "prepared" {
			t.Fatal("wrong prepared bet", recovered, err)
		}
		state, err := s.Status(ctx, item.session, item.session.GameID)
		if err != nil {
			t.Fatal(err)
		}
		frame, err := s.Spin(ctx, item.session, item.session.GameID, state.RequestID, 100)
		if err != nil || frame.BetID != item.id {
			t.Fatal("independent spin", frame, err)
		}
	}
	store.Close()
	reopened, err := postgres.Open(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	s = independentService(t, reopened, g)
	for _, item := range []struct {
		session play.Session
		id      string
	}{{first, a.BetID}, {second, b.BetID}} {
		state, err := s.Status(ctx, item.session, item.session.GameID)
		if err != nil || !state.HasNext || state.LastFrame == nil || state.LastFrame.BetID != item.id || state.Balance != 499820 {
			t.Fatal("independent restart recovery/shared wallet", state, err)
		}
	}
}
