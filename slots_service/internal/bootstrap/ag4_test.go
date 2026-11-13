package bootstrap

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	game "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/infrastructure/gamedata"
	"aislots/slots_service/internal/rules/paylines"
)

func TestAG4LocalReleaseAndFiveLinePolicy(t *testing.T) {
	config, err := LoadConfig("../../configs/server.test.json")
	if err != nil {
		t.Fatal(err)
	}
	var spec GameConfig
	for _, candidate := range config.Games {
		if filepath.Base(candidate.ConfigDir) == "AG4" {
			spec = candidate
		}
	}
	if spec.ConfigDir == "" {
		t.Fatal("AG4 not registered")
	}
	config.Games = []GameConfig{spec}
	catalog, err := LoadCatalog(config)
	if err != nil {
		t.Fatal(err)
	}
	defer catalog.Close()
	module, err := catalog.Resolve("AG4", "")
	if err != nil || module.Type() != paylines.RuleType {
		t.Fatal("wrong module", err)
	}
	var state game.State
	for i := 0; i < 20; i++ {
		out, err := module.Draw(context.Background(), game.Request{BetMinorUnits: 50, State: state})
		if err != nil {
			t.Fatal(err)
		}
		if err = module.ValidateStoredResult(out); err != nil {
			t.Fatal(err)
		}
		state = out.NextState
	}
	policies, err := gamedata.LoadBetPolicies(config.BetPoliciesFile)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, p := range policies {
		if p.GameID == "AG4" {
			found = true
			if p.LineCount != 5 || p.AmountScale != 2 || p.BetLevel != 10 {
				t.Fatal("wrong AG4 bet policy", p)
			}
		}
	}
	if !found {
		t.Fatal("missing AG4 policy")
	}
}

func TestPaylineRuleDoesNotImplicitlySelectAG4(t *testing.T) {
	root := filepath.Join(t.TempDir(), "AG5")
	if err := os.Mkdir(root, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "config.json"), []byte(`{"version":1,"ruleType":"paylines_v1"}`), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadCatalog(Config{Games: []GameConfig{{ConfigDir: root, Current: true}}}); err == nil {
		t.Fatal("unregistered payline game inherited AG4 state machine")
	}
}
