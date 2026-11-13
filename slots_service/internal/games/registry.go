// Package games is the explicit registration and persisted-format boundary.
package games

import (
	"encoding/json"
	"fmt"
	"strings"

	game "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/engine"
	"aislots/slots_service/internal/games/ag1"
	"aislots/slots_service/internal/games/ag2"
	"aislots/slots_service/internal/games/ag3"
	"aislots/slots_service/internal/games/ag4"
	"aislots/slots_service/internal/games/legacyways"
	"aislots/slots_service/internal/rules/paylines"
)

var waysModules = map[string]func(legacyways.Source) *legacyways.Runtime{
	"AG1": ag1.New, "AG2": ag2.New, "AG3": ag3.New,
}

func WrapWays(id string, source legacyways.Source) (game.Runtime, error) {
	build := waysModules[id]
	if build == nil || source == nil || source.Type() != engine.RuleType {
		return nil, fmt.Errorf("unregistered Ways game module %q", id)
	}
	return build(source), nil
}

// DecodeState explicitly recognizes only the historical Ways shape. A future
// module must register its own codec rather than falling back to Ways.
func DecodeState(raw []byte) (game.State, error) {
	var header struct {
		SchemaVersion *int   `json:"schemaVersion"`
		Version       string `json:"version"`
	}
	if err := json.Unmarshal(raw, &header); err != nil {
		return game.State{}, err
	}
	if header.SchemaVersion != nil {
		var out game.State
		if err := json.Unmarshal(raw, &out); err != nil {
			return out, err
		}
		if out.RuleType == paylines.RuleType {
			if *header.SchemaVersion != game.SchemaVersion {
				return out, fmt.Errorf("unknown AG4 state schema")
			}
			decoded, err := ag4.DecodeState(out)
			if err != nil {
				return out, err
			}
			out.Payload, _ = json.Marshal(decoded)
			return out, nil
		}
		if *header.SchemaVersion != game.SchemaVersion || out.RuleType != engine.RuleType || !strings.HasPrefix(out.Version, out.RuleType+":") || !json.Valid(out.Payload) {
			return out, fmt.Errorf("unknown state module/schema/version")
		}
		decoded, err := legacyways.UnwrapState(out, out.RuleType, out.Version)
		if err != nil {
			return out, err
		}
		return legacyways.WrapState(decoded, out.RuleType), nil
	}
	var old engine.State
	if err := strictJSON(raw, &old); err != nil {
		return game.State{}, err
	}
	if old.Version == "" && old.Sequence == 0 && old.Streak == 0 && old.FreeMisses == 0 && !old.HasTriggeredFree && old.Free == nil {
		return game.State{}, nil
	}
	if !strings.HasPrefix(old.Version, engine.RuleType+":") {
		return game.State{}, fmt.Errorf("unknown legacy state version")
	}
	return legacyways.WrapState(old, engine.RuleType), nil
}

func DecodeResult(raw []byte) (game.Result, error) {
	var header struct {
		SchemaVersion *int   `json:"schemaVersion"`
		Version       string `json:"version"`
		GameID        string `json:"gameId"`
	}
	if err := json.Unmarshal(raw, &header); err != nil {
		return game.Result{}, err
	}
	if header.SchemaVersion != nil {
		var out game.Result
		if err := json.Unmarshal(raw, &out); err != nil {
			return out, err
		}
		if out.RuleType == paylines.RuleType {
			if out.GameID != ag4.ID || !strings.HasPrefix(out.Version, out.RuleType+":") {
				return out, fmt.Errorf("unknown AG4 result version")
			}
			return out, out.Validate()
		}
		if out.RuleType != engine.RuleType || !strings.HasPrefix(out.Version, out.RuleType+":") || waysModules[out.GameID] == nil {
			return out, fmt.Errorf("unknown result module/version")
		}
		return out, out.Validate()
	}
	if !strings.HasPrefix(header.Version, engine.RuleType+":") || waysModules[header.GameID] == nil {
		return game.Result{}, fmt.Errorf("unknown legacy result module/version")
	}
	var old engine.SpinResult
	if err := strictJSON(raw, &old); err != nil {
		return game.Result{}, err
	}
	return legacyways.ImportResult(old, engine.RuleType)
}

func strictJSON(raw []byte, out any) error {
	d := json.NewDecoder(strings.NewReader(string(raw)))
	d.DisallowUnknownFields()
	return d.Decode(out)
}
