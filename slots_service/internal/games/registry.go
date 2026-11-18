// Package games is the explicit registration and persisted-format boundary.
package games

import (
	"encoding/json"
	"fmt"
	"strings"

	game "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/engine"
	"aislots/slots_service/internal/games/ag1"
	"aislots/slots_service/internal/games/ag10"
	"aislots/slots_service/internal/games/ag2"
	"aislots/slots_service/internal/games/ag3"
	"aislots/slots_service/internal/games/ag4"
	"aislots/slots_service/internal/games/ag5"
	"aislots/slots_service/internal/games/ag6"
	"aislots/slots_service/internal/games/ag7"
	"aislots/slots_service/internal/games/ag8"
	"aislots/slots_service/internal/games/ag9"
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
		if out.RuleType == ag5.RuleType {
			decoded, err := ag5.DecodeState(out)
			if err != nil {
				return out, err
			}
			out.Payload, _ = json.Marshal(decoded)
			return out, nil
		}
		if out.RuleType == ag9.RuleType {
			decoded, err := ag9.DecodeState(out)
			if err != nil {
				return out, err
			}
			out.Payload, _ = json.Marshal(decoded)
			return out, nil
		}
		if out.RuleType == ag8.RuleType {
			decoded, err := ag8.DecodeState(out)
			if err != nil {
				return out, err
			}
			out.Payload, _ = json.Marshal(decoded)
			return out, nil
		}
		if out.RuleType == ag7.RuleType {
			decoded, err := ag7.DecodeState(out)
			if err != nil {
				return out, err
			}
			out.Payload, _ = json.Marshal(decoded)
			return out, nil
		}
		if out.RuleType == ag6.RuleType {
			decoded, err := ag6.DecodeState(out)
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
		// AG10 retains the AG5 wire rule identifier but owns its snapshots and results.
		if out.GameID == ag10.ID && out.RuleType == ag10.RuleType {
			if !strings.HasPrefix(out.Version, ag10.RuleType+":") || len(out.Version) != len(ag10.RuleType)+65 {
				return out, fmt.Errorf("unknown AG10 result version")
			}
			if _, err := ag10.DecodeState(out.NextState); err != nil {
				return out, err
			}
			return out, out.Validate()
		}
		if out.RuleType == ag5.RuleType {
			if out.GameID != ag5.ID || !strings.HasPrefix(out.Version, ag5.RuleType+":") || len(out.Version) != len(ag5.RuleType)+65 {
				return out, fmt.Errorf("unknown AG5 result version")
			}
			if _, err := ag5.DecodeState(out.NextState); err != nil {
				return out, err
			}
			return out, out.Validate()
		}
		if out.RuleType == ag9.RuleType {
			if out.GameID != ag9.ID || !strings.HasPrefix(out.Version, ag9.RuleType+":") || len(out.Version) != len(ag9.RuleType)+65 {
				return out, fmt.Errorf("unknown AG9 result version")
			}
			if _, err := ag9.DecodeState(out.NextState); err != nil {
				return out, err
			}
			return out, out.Validate()
		}
		if out.RuleType == ag8.RuleType {
			if out.GameID != ag8.ID || !strings.HasPrefix(out.Version, ag8.RuleType+":") || len(out.Version) != len(ag8.RuleType)+65 {
				return out, fmt.Errorf("unknown AG8 result version")
			}
			if _, err := ag8.DecodeState(out.NextState); err != nil {
				return out, err
			}
			return out, out.Validate()
		}
		if out.RuleType == ag7.RuleType {
			if out.GameID != ag7.ID || !strings.HasPrefix(out.Version, ag7.RuleType+":") || len(out.Version) != len(ag7.RuleType)+65 {
				return out, fmt.Errorf("unknown AG7 result version")
			}
			if _, err := ag7.DecodeState(out.NextState); err != nil {
				return out, err
			}
			return out, out.Validate()
		}
		if out.RuleType == ag6.RuleType {
			if out.GameID != ag6.ID || !strings.HasPrefix(out.Version, ag6.RuleType+":") || len(out.Version) != len(ag6.RuleType)+65 {
				return out, fmt.Errorf("unknown AG6 result version")
			}
			if _, err := ag6.DecodeState(out.NextState); err != nil {
				return out, err
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
