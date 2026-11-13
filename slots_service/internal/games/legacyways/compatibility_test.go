package legacyways_test

import (
	"context"
	"encoding/json"
	"math/rand"
	"reflect"
	"testing"

	"aislots/slots_service/internal/bootstrap"
	game "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/engine"
	"aislots/slots_service/internal/games"
	"aislots/slots_service/internal/games/legacyways"
	"aislots/slots_service/internal/infrastructure/gamedata"
)

// Compare the adapter against the unchanged engine, including RNG consumption.
// Use deployed immutable configs rather than the editable math workspace.
func TestWaysCompatibility(t *testing.T) {
	config, err := bootstrap.LoadConfig("../../../configs/server.lobby.json")
	if err != nil {
		t.Fatal(err)
	}
	for _, spec := range config.Games {
		kind, kindErr := gamedata.ReadRuleType(spec.ConfigDir)
		if kindErr != nil {
			t.Fatal(kindErr)
		}
		if !spec.Current || kind != engine.RuleType {
			continue
		}
		rules, err := gamedata.LoadGame(spec.ConfigDir)
		if err != nil {
			t.Fatal(err)
		}
		t.Run(rules.ID, func(t *testing.T) {
			lib, err := gamedata.OpenDiskLibrary(spec.BaseLibraryDir, spec.FreeLibraryDir)
			if err != nil {
				t.Fatal(err)
			}
			defer lib.Close()
			a, b := rand.New(rand.NewSource(42)), rand.New(rand.NewSource(42))
			options := engine.Options{TriggerSymbolCount: spec.TriggerSymbolCount, FreeAwardSymbolCounts: spec.FreeAwardSymbolCounts, MaxFillAttempts: spec.MaxFillAttempts}
			options.Random = func() (float64, error) { return a.Float64(), nil }
			old, err := engine.NewEngine(rules, lib, options)
			if err != nil {
				t.Fatal(err)
			}
			options.Random = func() (float64, error) { return b.Float64(), nil }
			next, err := engine.NewEngine(rules, lib, options)
			if err != nil {
				t.Fatal(err)
			}
			runtime, err := games.WrapWays(rules.ID, next)
			if err != nil {
				t.Fatal(err)
			}
			var before engine.State
			var state game.State
			seenFree, seenCascade, seenGold := false, false, false
			for i := 0; i < 1500; i++ {
				stake := int64(123)
				if before.Free != nil {
					stake = 0
				}
				want, err := old.Spin(context.Background(), engine.SpinRequest{State: before, BetMinorUnits: stake})
				if err != nil {
					t.Fatal(i, err)
				}
				got, err := runtime.Draw(context.Background(), game.Request{State: state, BetMinorUnits: stake})
				if err != nil {
					t.Fatal(i, err)
				}
				var actual engine.SpinResult
				if err = json.Unmarshal(got.Payload, &actual); err != nil {
					t.Fatal(err)
				}
				if !reflect.DeepEqual(want, actual) {
					t.Fatalf("spin %d changed outcome", i)
				}
				if err = runtime.ValidateStoredResult(got); err != nil {
					t.Fatal(i, err)
				}
				raw, _ := json.Marshal(got)
				restored, err := games.DecodeResult(raw)
				if err != nil {
					t.Fatal(err)
				}
				if err = runtime.ValidateStoredResult(restored); err != nil {
					t.Fatal(err)
				}
				if i == 0 {
					changed := restored
					changed.Frames = append([]game.Frame(nil), restored.Frames...)
					changed.Frames[0].Payload = json.RawMessage(`{}`)
					if err = runtime.ValidateStoredResult(changed); err == nil {
						t.Fatal("modified frame plan accepted")
					}
					changed = restored
					changed.Version = "wrong-version"
					if err = runtime.ValidateStoredResult(changed); err == nil {
						t.Fatal("wrong result version accepted")
					}
				}
				// Old raw result/state codecs must preserve already drawn outcomes.
				raw, _ = json.Marshal(want)
				legacy, err := games.DecodeResult(raw)
				if err != nil {
					t.Fatal(err)
				}
				if !reflect.DeepEqual(legacy, got) {
					t.Fatal("old result codec changed frame plan")
				}
				raw, _ = json.Marshal(want.NextState)
				state, err = games.DecodeState(raw)
				if err != nil {
					t.Fatal(err)
				}
				if !reflect.DeepEqual(state, got.NextState) {
					t.Fatal("old state codec changed state")
				}
				var sum int64
				for _, f := range got.Frames {
					sum += f.WinMinorUnits
				}
				if sum != want.WinMinorUnits {
					t.Fatal("frame credits differ")
				}
				before = want.NextState
				seenFree = seenFree || want.Mode == engine.Free
				seenCascade = seenCascade || len(want.Round.Steps) > 1
				for _, s := range want.Round.Steps {
					seenGold = seenGold || len(s.Transformed) > 0
				}
			}
			if !seenFree || !seenCascade || !seenGold {
				t.Fatalf("missing coverage free=%v cascade=%v gold=%v", seenFree, seenCascade, seenGold)
			}
			if a.Float64() != b.Float64() {
				t.Fatal("adapter consumed extra randomness")
			}
		})
	}
}

func TestUnknownStoredVersionsRejected(t *testing.T) {
	for _, raw := range []string{`{"schemaVersion":99,"ruleType":"ways_cascade_v1","version":"x","payload":{}}`, `{"version":"unknown:v1","sequence":1}`} {
		if _, err := games.DecodeState([]byte(raw)); err == nil {
			t.Fatal("accepted unknown state", raw)
		}
	}
	if _, err := games.WrapWays("UNREGISTERED", nil); err == nil {
		t.Fatal("unknown module accepted")
	}
	_ = legacyways.StateSchema
}
