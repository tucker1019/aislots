package bootstrap

import (
	game "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/games/ag8"
	"aislots/slots_service/internal/infrastructure/gamedata"
	"context"
	"path/filepath"
	"testing"
)

func TestAG8LocalReleaseAndFiveLinePolicy(t *testing.T) {
	c, err := LoadConfig("../../configs/server.test.json")
	if err != nil {
		t.Fatal(err)
	}
	var spec GameConfig
	for _, s := range c.Games {
		if filepath.Base(s.ConfigDir) == "AG8" {
			spec = s
		}
	}
	if spec.ConfigDir == "" {
		t.Fatal("AG8 not registered")
	}
	c.Games = []GameConfig{spec}
	catalog, err := LoadCatalog(c)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = catalog.Close() }()
	r, err := catalog.Resolve("AG8", "")
	if err != nil || r.Type() != ag8.RuleType {
		t.Fatal("wrong AG8 module", err)
	}
	var state game.State
	for i := 0; i < 10; i++ {
		out, err := r.Draw(context.Background(), game.Request{BetMinorUnits: 100, State: state})
		if err != nil {
			t.Fatal(err)
		}
		if err = r.ValidateStoredResult(out); err != nil {
			t.Fatal(err)
		}
		state = out.NextState
	}
	policies, err := gamedata.LoadBetPolicies(c.BetPoliciesFile)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, p := range policies {
		if p.GameID == "AG8" {
			found = true
			if p.LineCount != 5 || p.AmountScale != 2 || p.BetLevel != 10 {
				t.Fatal("bad AG8 policy", p)
			}
		}
	}
	if !found {
		t.Fatal("missing AG8 policy")
	}
	if _, err = catalog.Resolve("AG4", r.Version()); err == nil {
		t.Fatal("AG8 loaded as another game")
	}
}
