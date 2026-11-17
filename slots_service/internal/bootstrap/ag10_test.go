package bootstrap

import (
	game "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/games/ag10"
	"aislots/slots_service/internal/infrastructure/gamedata"
	"context"
	"path/filepath"
	"testing"
)

func TestAG10LocalReleaseAndTenLinePolicy(t *testing.T) {
	c, err := LoadConfig("../../configs/server.test.json")
	if err != nil {
		t.Fatal(err)
	}
	var spec GameConfig
	for _, s := range c.Games {
		if filepath.Base(s.ConfigDir) == "AG10" {
			spec = s
		}
	}
	if spec.ConfigDir == "" {
		t.Fatal("AG10 not registered")
	}
	c.Games = []GameConfig{spec}
	catalog, err := LoadCatalog(c)
	if err != nil {
		t.Fatal(err)
	}
	defer catalog.Close()
	r, err := catalog.Resolve("AG10", "")
	if err != nil || r.Type() != ag10.RuleType {
		t.Fatal("wrong AG10 module", err)
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
		if p.GameID == "AG10" {
			found = true
			if p.LineCount != 10 || p.AmountScale != 2 || p.BetLevel != 10 {
				t.Fatal("bad AG10 policy", p)
			}
		}
	}
	if !found {
		t.Fatal("missing AG10 policy")
	}
	if _, err = catalog.Resolve("AG4", r.Version()); err == nil {
		t.Fatal("AG10 loaded as another game")
	}
}
