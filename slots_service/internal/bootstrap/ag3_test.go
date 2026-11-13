package bootstrap

import (
	"aislots/slots_service/internal/application/betlist"
	game "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/domain/identity"
	"aislots/slots_service/internal/engine"
	"aislots/slots_service/internal/infrastructure/gamedata"
	"context"
	"encoding/json"
	"reflect"
	"testing"
)

func TestVerifiedAG3BatchAndBetPolicyAreEnabled(t *testing.T) {
	for _, path := range []string{"../../configs/server.lobby.json", "../../configs/server.test.json"} {
		t.Run(path, func(t *testing.T) {
			config, err := LoadConfig(path)
			if err != nil {
				t.Fatal(err)
			}
			catalog, err := LoadCatalog(config)
			if err != nil {
				t.Fatal(err)
			}
			defer catalog.Close()
			for _, id := range []string{"AG1", "AG2", "AG3"} {
				if _, err := catalog.Resolve(id, ""); err != nil {
					t.Fatal(err)
				}
			}
			policies, err := gamedata.LoadBetPolicies(config.BetPoliciesFile)
			if err != nil {
				t.Fatal(err)
			}
			bets, err := betlist.New(policies)
			if err != nil {
				t.Fatal(err)
			}
			player := identity.Context{Subject: identity.Subject{AppName: "test", AppKey: "web", UID: "ag3-test"}, Country: "ID", Currency: "IDR"}
			policy, err := bets.List(context.Background(), player, "AG3")
			if err != nil {
				t.Fatal(err)
			}
			if policy.AmountScale != 2 || policy.LineCount != 20 || policy.BetLevel != 10 || policy.Default != 10 || !reflect.DeepEqual(policy.Amounts, []int64{10, 50, 100, 500, 1000}) {
				t.Fatalf("wrong AG3 policy: %+v", policy)
			}
			rules, _ := catalog.Resolve("AG3", "")
			state := game.State{}
			for i := 0; i < 1000; i++ {
				amount := int64(200)
				if state.Pending {
					amount = 0
				}
				result, err := rules.Draw(context.Background(), game.Request{BetMinorUnits: amount, State: state})
				if err != nil {
					t.Fatalf("AG3 spin %d: %v", i, err)
				}
				var legacy engine.SpinResult
				if err := json.Unmarshal(result.Payload, &legacy); err != nil {
					t.Fatal(err)
				}
				if result.GameID != "AG3" || len(legacy.Round.Initial) != 6 {
					t.Fatalf("wrong AG3 board: %+v", result)
				}
				for c, h := range []int{3, 4, 5, 5, 4, 3} {
					if len(legacy.Round.Initial[c]) != h {
						t.Fatalf("column %d has %d cells, want %d", c, len(legacy.Round.Initial[c]), h)
					}
				}
				state = result.NextState
			}
		})
	}
}
