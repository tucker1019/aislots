package bootstrap

import (
	game "aislots/slots_service/internal/domain/game"
	"context"
	"testing"
)

func TestVerifiedAG2BatchIsEnabled(t *testing.T) {
	config, err := LoadConfig("../../configs/server.lobby.json")
	if err != nil {
		t.Fatal(err)
	}
	catalog, err := LoadCatalog(config)
	if err != nil {
		t.Fatal(err)
	}
	defer catalog.Close()
	if _, err := catalog.Resolve("AG1", ""); err != nil {
		t.Fatal(err)
	}
	rules, err := catalog.Resolve("AG2", "")
	if err != nil {
		t.Fatal(err)
	}
	state := game.State{}
	for i := 0; i < 1000; i++ {
		amount := int64(100)
		if state.Pending {
			amount = 0
		}
		result, err := rules.Draw(context.Background(), game.Request{BetMinorUnits: amount, State: state})
		if err != nil {
			t.Fatalf("AG2 spin %d: %v", i, err)
		}
		if result.GameID != "AG2" {
			t.Fatal("wrong game")
		}
		state = result.NextState
	}
}
