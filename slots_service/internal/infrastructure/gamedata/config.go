package gamedata

import (
	"aislots/slots_service/internal/engine"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
)

// LoadGame reads the existing four JSON files without changing them.
func LoadGame(gameDir string) (engine.Game, error) {
	kind, err := ReadRuleType(gameDir)
	if err != nil {
		return engine.Game{}, err
	}
	if kind != engine.RuleType {
		return engine.Game{}, fmt.Errorf("%s loader cannot read ruleType %q", engine.RuleType, kind)
	}
	game := engine.Game{ID: filepath.Base(filepath.Clean(gameDir))}
	read := func(name string, target any) error {
		data, err := os.ReadFile(filepath.Join(gameDir, name))
		if err != nil {
			return err
		}
		if name == "config.json" {
			var root map[string]json.RawMessage
			if err := json.Unmarshal(data, &root); err != nil {
				return err
			}
			if err := requireFields(root["parameters"], "lineCount", "baseSpinWinProbability", "freeSpinWinProbability", "freeSpinTriggerProbability", "freeSpinGuaranteedWin", "lossStreakRtpCompensation", "freeTriggerRtpCompensation", "freeSpinAwardWeights"); err != nil {
				return fmt.Errorf("config.json: %w", err)
			}
			var params map[string]json.RawMessage
			if err := json.Unmarshal(root["parameters"], &params); err != nil {
				return err
			}
			for _, key := range []string{"lossStreakRule", "winStreakRule", "freeTriggerRule"} {
				if raw, ok := params[key]; ok {
					fields := []string{"enabled", "start", "interval", "step", "cap"}
					if key != "freeTriggerRule" {
						fields = append(fields, "probability")
					}
					if err := requireFields(raw, fields...); err != nil {
						return fmt.Errorf("%s: %w", key, err)
					}
				}
			}
		}
		if name == "board.json" {
			if err := requireFields(data, "version", "columnHeights", "symbols", "cascadeFactors", "freeCascadeFactors", "fillWeightIncrement", "scatterWeightIncrement", "gold"); err != nil {
				return err
			}
			var root map[string]json.RawMessage
			if err := json.Unmarshal(data, &root); err != nil {
				return err
			}
			// A null wildSymbolId explicitly disables conversion.
			var gold map[string]json.RawMessage
			if err := json.Unmarshal(root["gold"], &gold); err != nil {
				return err
			}
			for _, key := range []string{"columns", "baseProbability", "freeProbability", "wildSymbolId"} {
				if _, ok := gold[key]; !ok {
					return fmt.Errorf("gold.%s required", key)
				}
			}
		}
		return json.Unmarshal(data, target)
	}
	var file struct {
		Version    int               `json:"version"`
		Parameters engine.Parameters `json:"parameters"`
	}
	if err := read("config.json", &file); err != nil {
		return game, err
	}
	if file.Version != 1 {
		return game, fmt.Errorf("unsupported config.json version")
	}
	game.Parameters = file.Parameters
	for _, entry := range []struct {
		name   string
		target any
	}{{"board.json", &game.Board}, {"base.json", &game.BaseRows}, {"free.json", &game.FreeRows}} {
		if err := read(entry.name, entry.target); err != nil {
			return game, err
		}
	}
	return game, nil
}

func requireFields(data []byte, fields ...string) error {
	var object map[string]json.RawMessage
	if err := json.Unmarshal(data, &object); err != nil {
		return err
	}
	for _, key := range fields {
		value, ok := object[key]
		if !ok || string(value) == "null" {
			return fmt.Errorf("%s is required", key)
		}
	}
	return nil
}

// ReadRuleType reads only shared game metadata, before choosing a type-specific loader.
func ReadRuleType(gameDir string) (string, error) {
	data, err := os.ReadFile(filepath.Join(gameDir, "config.json"))
	if err != nil {
		return "", err
	}
	var metadata struct {
		Version  int    `json:"version"`
		RuleType string `json:"ruleType"`
	}
	if err = json.Unmarshal(data, &metadata); err != nil {
		return "", err
	}
	if metadata.Version != 1 {
		return "", fmt.Errorf("unsupported config.json version")
	}
	if !regexp.MustCompile(`^[a-z][a-z0-9_]*_v[1-9][0-9]*$`).MatchString(metadata.RuleType) {
		return "", fmt.Errorf("config.json requires a versioned ruleType")
	}
	return metadata.RuleType, nil
}
