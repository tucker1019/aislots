// Package legacyways adapts the existing Ways engine without changing its RNG,
// persisted outcome, or per-cascade credits. It owns the legacy wire format.
package legacyways

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"

	game "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/engine"
)

const StateSchema = 1

type Source interface {
	Type() string
	Version() string
	Spin(context.Context, engine.SpinRequest) (engine.SpinResult, error)
}

// Profile describes the existing client's visual layout, not the prize rules.
type Profile struct {
	Columns, BottomSymbolCount int
	FreeBottomGoldColumn       int // 1-based; zero disables
	AllowTallPreview           bool
}

type Runtime struct {
	source  Source
	gameID  string
	profile Profile
}

func New(id string, source Source, profile Profile) *Runtime { return &Runtime{source, id, profile} }
func (r *Runtime) Type() string                              { return r.source.Type() }
func (r *Runtime) Version() string                           { return r.source.Version() }

func WrapState(s engine.State, kind string) game.State {
	raw, _ := json.Marshal(s)
	return game.State{RuleType: kind, Version: s.Version, SchemaVersion: StateSchema, Pending: s.Free != nil, Payload: raw}
}

func UnwrapState(s game.State, kind, version string) (engine.State, error) {
	if s.SchemaVersion == 0 && s.RuleType == "" && !s.Pending && (len(s.Payload) == 0 || string(s.Payload) == "null") {
		if s.Version != "" && s.Version != version {
			return engine.State{}, engine.ErrVersion
		}
		return engine.State{Version: s.Version}, nil
	}
	if s.SchemaVersion != StateSchema || s.RuleType != kind || s.Version != version {
		return engine.State{}, engine.ErrVersion
	}
	var out engine.State
	if err := decodeStoredJSON(s.Payload, &out); err != nil {
		return out, err
	}
	if out.Version != s.Version || (out.Free != nil) != s.Pending {
		return out, fmt.Errorf("state envelope/payload mismatch")
	}
	return out, nil
}

func (r *Runtime) Draw(ctx context.Context, req game.Request) (game.Result, error) {
	state, err := UnwrapState(req.State, r.Type(), req.State.Version)
	if err != nil {
		return game.Result{}, err
	}
	// Only a new paid rotation may migrate a completed Ways state to the
	// ticket's version. Active bonus sessions must remain pinned.
	if state.Version != r.Version() {
		if req.State.Pending || req.BetMinorUnits <= 0 {
			return game.Result{}, engine.ErrVersion
		}
		state.Version = r.Version()
	}
	out, err := r.source.Spin(ctx, engine.SpinRequest{BetMinorUnits: req.BetMinorUnits, State: state})
	if err != nil {
		return game.Result{}, err
	}
	result, err := ImportResult(out, r.Type())
	if err != nil {
		return game.Result{}, err
	}
	if result.GameID != r.gameID || result.Version != r.Version() || result.ChargeMinorUnits != req.BetMinorUnits {
		return game.Result{}, fmt.Errorf("Ways settlement identity mismatch")
	}
	return result, nil
}

func ImportResult(old engine.SpinResult, kind string) (game.Result, error) {
	amounts, err := SplitAwards(old)
	if err != nil {
		return game.Result{}, err
	}
	payload, err := json.Marshal(old)
	if err != nil {
		return game.Result{}, err
	}
	out := game.Result{SchemaVersion: game.SchemaVersion, RuleType: kind, GameID: old.GameID, Version: old.Version, BetMinorUnits: old.BetMinorUnits, ChargeMinorUnits: old.ChargeMinorUnits, WinMinorUnits: old.WinMinorUnits, NextState: WrapState(old.NextState, kind), Payload: payload}
	n := len(old.Round.Steps)
	for i := 0; i <= n; i++ {
		data := Display{Mode: old.Mode, Wins: []engine.Win{}, RemovedIDs: []int{}, TransformedIDs: []int{}, TriggeredFree: old.TriggeredFree, AwardedFreeSpins: old.AwardedFreeSpins, CascadeFactors: old.Round.CascadeFactors, CascadeIndex: max(0, min(i, len(old.Round.CascadeFactors)-1))}
		if old.NextState.Free != nil {
			data.FreeRemaining = old.NextState.Free.Remaining
		}
		action := "continue"
		win := int64(0)
		if i < n {
			s := old.Round.Steps[i]
			data.Board = s.Before
			data.Wins = s.Wins
			data.RemovedIDs = s.Removed
			data.TransformedIDs = s.Transformed
			win = amounts[i]
		} else {
			data.Board = old.Round.Final
			action = "complete"
			if old.NextState.Free != nil {
				action = "start_free"
			}
		}
		for _, a := range amounts[:min(i+1, len(amounts))] {
			data.SpinWinAmount += a
		}
		raw, err := json.Marshal(data)
		if err != nil {
			return game.Result{}, err
		}
		out.Frames = append(out.Frames, game.Frame{WinMinorUnits: win, NextAction: action, Payload: raw})
	}
	return out, out.Validate()
}

// Stored payloads are checked against their deterministic frame plan. Never
// re-draw a stored outcome or use current configuration to recover an old one.
func (r *Runtime) ValidateStoredResult(out game.Result) error {
	if err := out.Validate(); err != nil {
		return err
	}
	if out.GameID != r.gameID || out.RuleType != r.Type() || out.Version != r.Version() {
		return fmt.Errorf("stored module/version mismatch")
	}
	var old engine.SpinResult
	if err := decodeStoredJSON(out.Payload, &old); err != nil {
		return err
	}
	if validator, ok := r.source.(interface{ ValidateStoredResult(engine.SpinResult) error }); ok {
		if err := validator.ValidateStoredResult(old); err != nil {
			return err
		}
	}
	expected, err := ImportResult(old, r.Type())
	if err != nil {
		return err
	}

	if out.GameID != expected.GameID || out.Version != expected.Version || out.BetMinorUnits != expected.BetMinorUnits || out.ChargeMinorUnits != expected.ChargeMinorUnits || out.WinMinorUnits != expected.WinMinorUnits || len(out.Frames) != len(expected.Frames) {
		return fmt.Errorf("stored Ways result/plan mismatch")
	}
	state, err := UnwrapState(out.NextState, r.Type(), r.Version())
	if err != nil {
		return err
	}
	if !reflect.DeepEqual(state, old.NextState) {
		return fmt.Errorf("stored Ways next state mismatch")
	}
	// Decode into the module's typed DTOs: JSONB can reorder keys and rewrite
	// exponents, while uint64/int64 amounts must retain their exact precision.
	for i, frame := range out.Frames {
		plan := expected.Frames[i]
		if frame.WinMinorUnits != plan.WinMinorUnits || frame.NextAction != plan.NextAction {
			return fmt.Errorf("stored Ways frame settlement mismatch")
		}
		var actual, want Display
		if err = decodeStoredJSON(frame.Payload, &actual); err != nil {
			return err
		}
		if err = decodeStoredJSON(plan.Payload, &want); err != nil {
			return err
		}
		if !reflect.DeepEqual(actual, want) {
			return fmt.Errorf("stored Ways frame presentation mismatch")
		}
	}
	return nil
}
