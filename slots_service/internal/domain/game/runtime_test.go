package game

import (
	"encoding/json"
	"testing"
)

func TestFramePlanSupportsFinalOnlyCredit(t *testing.T) {
	result := Result{SchemaVersion: 1, RuleType: "locked_respin_v1", GameID: "future", Version: "locked_respin_v1:one", BetMinorUnits: 50, ChargeMinorUnits: 50, WinMinorUnits: 125, Payload: json.RawMessage(`{"target":3}`), NextState: State{RuleType: "locked_respin_v1", Version: "locked_respin_v1:one", SchemaVersion: 1, Payload: json.RawMessage(`{}`)}, Frames: []Frame{
		{NextAction: "continue", Payload: json.RawMessage(`{"locked":[]}`)},
		{NextAction: "continue", Payload: json.RawMessage(`{"locked":[1]}`)},
		{NextAction: "complete", WinMinorUnits: 125, Payload: json.RawMessage(`{"locked":[1,2,3]}`)},
	}}
	if err := result.Validate(); err != nil {
		t.Fatal(err)
	}
	result.Frames[0].WinMinorUnits = 125
	if err := result.Validate(); err == nil {
		t.Fatal("double credit accepted")
	}
	result.Frames[0].WinMinorUnits = -1
	if err := result.Validate(); err == nil {
		t.Fatal("negative credit accepted")
	}
}
