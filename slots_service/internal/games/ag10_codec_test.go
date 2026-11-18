package games

import (
	game "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/games/ag10"
	"context"
	"encoding/json"
	"path/filepath"
	"testing"
)

func TestAG10PersistedCodecs(t *testing.T) {
	root := "../../testdata/deployments/2026-11-16-ag10-v2/AG10"
	r, err := ag10.Load(root, filepath.Join(root, "base-library"), filepath.Join(root, "free-library"), ag10.Options{})
	if err != nil {
		t.Fatal(err)
	}
	out, err := r.Draw(context.Background(), game.Request{BetMinorUnits: 100})
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(out)
	decoded, err := DecodeResult(raw)
	if err != nil {
		t.Fatal(err)
	}
	if err = r.ValidateStoredResult(decoded); err != nil {
		t.Fatal(err)
	}
	raw, _ = json.Marshal(out.NextState)
	state, err := DecodeState(raw)
	if err != nil || state.Version != r.Version() {
		t.Fatal("state decode", err)
	}
	for _, mutate := range []func(*game.Result){func(o *game.Result) { o.GameID = "AG4" }, func(o *game.Result) { o.SchemaVersion = 99 }, func(o *game.Result) { o.Version = "unknown" }, func(o *game.Result) { o.NextState.SchemaVersion = 99 }} {
		copy := out
		mutate(&copy)
		raw, _ = json.Marshal(copy)
		if _, err = DecodeResult(raw); err == nil {
			t.Fatal("unknown AG10 result accepted")
		}
	}
	state.SchemaVersion = 99
	raw, _ = json.Marshal(state)
	if _, err = DecodeState(raw); err == nil {
		t.Fatal("unknown AG10 state accepted")
	}
}
