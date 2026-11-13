// Package game defines the platform contract, independent of matching rules.
package game

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
)

const SchemaVersion = 1

// State is an immutable, versioned module snapshot. Pending means another
// rotation belongs to the current paid round; it does not imply free spins.
type State struct {
	RuleType      string          `json:"ruleType"`
	Version       string          `json:"version"`
	SchemaVersion int             `json:"schemaVersion"`
	Pending       bool            `json:"pending"`
	Payload       json.RawMessage `json:"payload"`
}

type Request struct {
	BetMinorUnits int64
	State         State
}

// Frame is an explicit credit and presentation plan. The last frame commits
// NextState. Payload is decoded and validated by the owning module only.
type Frame struct {
	WinMinorUnits int64           `json:"winMinorUnits"`
	NextAction    string          `json:"nextAction"`
	Payload       json.RawMessage `json:"payload"`
}

type Result struct {
	SchemaVersion    int             `json:"schemaVersion"`
	RuleType         string          `json:"ruleType"`
	GameID           string          `json:"gameId"`
	Version          string          `json:"version"`
	BetMinorUnits    int64           `json:"betMinorUnits"`
	ChargeMinorUnits int64           `json:"chargeMinorUnits"`
	WinMinorUnits    int64           `json:"winMinorUnits"`
	NextState        State           `json:"nextState"`
	Frames           []Frame         `json:"frames"`
	Payload          json.RawMessage `json:"payload"`
}

type FrameContext struct {
	RoundID               string
	SpinIndex, FrameIndex int
}

type Runtime interface {
	Type() string
	Version() string
	Draw(context.Context, Request) (Result, error)
	ValidateStoredResult(Result) error
	Present(Result, FrameContext) (json.RawMessage, error)
}

// Validate checks financial and version boundaries without interpreting payloads.
func (r Result) Validate() error {
	if r.SchemaVersion != SchemaVersion || r.RuleType == "" || r.GameID == "" || r.Version == "" || r.BetMinorUnits <= 0 || r.ChargeMinorUnits < 0 || r.WinMinorUnits < 0 || len(r.Frames) == 0 || !json.Valid(r.Payload) {
		return fmt.Errorf("invalid game result envelope")
	}
	if r.NextState.Version != r.Version || r.NextState.RuleType != r.RuleType || r.NextState.SchemaVersion != SchemaVersion || !json.Valid(r.NextState.Payload) {
		return fmt.Errorf("invalid next-state envelope")
	}
	var total int64
	for i, f := range r.Frames {
		if f.WinMinorUnits < 0 || total > math.MaxInt64-f.WinMinorUnits || !json.Valid(f.Payload) || f.NextAction == "" {
			return fmt.Errorf("invalid frame plan")
		}
		if i < len(r.Frames)-1 && f.NextAction != "continue" {
			return fmt.Errorf("premature frame boundary")
		}
		total += f.WinMinorUnits
	}
	if total != r.WinMinorUnits {
		return fmt.Errorf("frame credits differ from total")
	}
	if r.NextState.Pending == (r.Frames[len(r.Frames)-1].NextAction == "complete") {
		return fmt.Errorf("invalid round boundary")
	}
	return nil
}
