package games

import (
	game "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/games/ag9"
	"context"
	"encoding/json"
	"path/filepath"
	"testing"
)

func TestAG9OwnCodecRejectsForeignIdentity(t *testing.T) {
	root := "../../testdata/deployments/2026-11-15-ag9/AG9"
	r, err := ag9.Load(root, filepath.Join(root, "base-library"), filepath.Join(root, "free-library"), ag9.Options{})
	if err != nil {
		t.Fatal(err)
	}
	out, err := r.Draw(context.Background(), game.Request{BetMinorUnits: 123})
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
	state, _ := json.Marshal(out.NextState)
	if _, err = DecodeState(state); err != nil {
		t.Fatal(err)
	}
	out.GameID = "AG4"
	raw, _ = json.Marshal(out)
	if _, err = DecodeResult(raw); err == nil {
		t.Fatal("AG9 decoded as AG4")
	}
	out.NextState.RuleType = "paylines_v1"
	state, _ = json.Marshal(out.NextState)
	if _, err = DecodeState(state); err == nil {
		t.Fatal("foreign state accepted")
	}
}
