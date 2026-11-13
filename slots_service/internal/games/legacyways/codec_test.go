package legacyways

import (
	game "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/engine"
	"context"
	"encoding/json"
	"strings"
	"testing"
)

type storedSource struct{}

func (storedSource) Type() string    { return engine.RuleType }
func (storedSource) Version() string { return engine.RuleType + ":one" }
func (storedSource) Spin(context.Context, engine.SpinRequest) (engine.SpinResult, error) {
	panic("stored validation must not draw")
}

func TestJSONBComparisonKeepsExactNumbers(t *testing.T) {
	source := storedSource{}
	old := engine.SpinResult{GameID: "AG1", Version: source.Version(), Mode: engine.Base, BetMinorUnits: 100, ChargeMinorUnits: 100, ExactWinMinorUnits: "0", Round: engine.Round{RawMultiplier: "0"}, NextState: engine.State{Version: source.Version(), Sequence: 9007199254740993, Free: &engine.FreeSession{Remaining: 1, BetMinorUnits: 100, WinProbability: 1e-7}}}
	result, err := ImportResult(old, engine.RuleType)
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(result)
	raw = []byte(strings.ReplaceAll(string(raw), "1e-7", "0.0000001"))
	var restored game.Result
	if err = json.Unmarshal(raw, &restored); err != nil {
		t.Fatal(err)
	}
	runtime := New("AG1", source, Profile{})
	if err = runtime.ValidateStoredResult(restored); err != nil {
		t.Fatal("JSONB numeric normalization rejected", err)
	}
	restored.NextState.Payload = []byte(strings.ReplaceAll(string(restored.NextState.Payload), "9007199254740993", "9007199254740992"))
	if err = runtime.ValidateStoredResult(restored); err == nil {
		t.Fatal("large state integer lost precision")
	}
}
