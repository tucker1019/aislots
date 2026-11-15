package ag5

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"testing"
)

const release = "../../../testdata/deployments/2026-11-15-ag5/AG5"
const baseCandidate = "../../../../game_libraries/AG5/base/2026-11-14T08-53-17-412Z-3bb98183"
const freeCandidate = "../../../../game_libraries/AG5/free/2026-11-14T08-53-18-079Z-e260cd78"

func TestCurrentReleaseCoverageAndSinglePassEverySkeleton(t *testing.T) {
	c, err := LoadConfig(release)
	if err != nil {
		t.Fatal(err)
	}
	r, err := Load(release, filepath.Join(release, "base-library"), filepath.Join(release, "free-library"), Options{})
	if err != nil {
		t.Fatal(err)
	}
	for mode, count := range map[string]int{"base": 1440, "free": 2635} {
		lib, m, err := LoadLibrary(c, mode, filepath.Join(release, mode+"-library"))
		if err != nil || m.Required != count || m.Covered != count {
			t.Fatal(mode, m, err)
		}
		for key, list := range lib {
			for _, s := range list {
				board, err := r.fill(s, mode, random{&zeroReader{}})
				if err != nil {
					t.Fatal(mode, key, err)
				}
				e, _ := Evaluate(c.Rules, board, mode)
				if key != strconv.FormatInt(e.RawPayout, 10) {
					t.Fatal("changed published multiplier")
				}
			}
		}
	}
}
func TestConfigurationAndLibraryFailures(t *testing.T) {
	r := testRuntime(t, Options{})
	cases := map[string]func(*Config){
		"four positive normals": func(c *Config) { c.Rules.Symbols[0].Weight = "0"; c.Rules.Symbols[1].Weight = "0" },
		"line changed":          func(c *Config) { c.Rules.Lines[0][0] = 2 },
		"invalid probability":   func(c *Config) { c.Parameters.Trigger = "1.01" },
		"missing probability":   func(c *Config) { c.Parameters.FreeWin = "" },
		"bad cap":               func(c *Config) { c.Parameters.MaxWin = 5001 },
		"zero row":              func(c *Config) { c.Base = append(c.Base, WeightRow{"0", "1"}) },
		"duplicate row":         func(c *Config) { c.Base = append(c.Base, c.Base[0]) },
		"negative weight":       func(c *Config) { c.Free[0][1] = "-1" },
		"overlapping symbol":    func(c *Config) { c.Rules.Rewards[0].ID = 1 },
	}
	for name, modify := range cases {
		t.Run(name, func(t *testing.T) {
			raw, _ := json.Marshal(r.config)
			var c Config
			_ = json.Unmarshal(raw, &c)
			modify(&c)
			if c.Validate() == nil {
				t.Fatal("invalid config accepted")
			}
		})
	}
	raw, _ := json.Marshal(r.base)
	var missing Library
	_ = json.Unmarshal(raw, &missing)
	delete(missing, "100")
	raw, _ = json.Marshal(missing)
	if _, _, _, err := ValidateLibrary(r.config, "base", raw); err == nil {
		t.Fatal("missing positive bucket accepted")
	}
	for _, data := range []string{`{"100":[{"cells":[0,6,3,6,7,6],"balance":1}]}`, `{"100":[{"cells":[0,6,3,6,7,6,9,2]}]}`, `{"100":[]}`, `{"99":[{"cells":[0,6,3,6,7,6]}]}`, `{} {}`} {
		if _, _, _, err := ValidateLibrary(r.config, "base", []byte(data)); err == nil {
			t.Fatal("invalid skeleton accepted", data)
		}
	}
	if _, _, _, err := ValidateLibrary(r.config, "other", raw); err == nil {
		t.Fatal("unknown mode accepted")
	}
	// Tiny decimal weights survive exact conversion; zero weights cannot win.
	w, err := newWeighted([]string{"zero", "tiny"}, []string{"0", "1e-100"})
	if err != nil {
		t.Fatal(err)
	}
	key, err := w.pick(random{&zeroReader{}})
	if err != nil || key != "tiny" {
		t.Fatal("tiny weight lost", key, err)
	}
}

func TestPublishRevalidatesCurrentMathAndNeverEditsCandidates(t *testing.T) {
	before, err := os.ReadFile(filepath.Join(baseCandidate, "manifest.json"))
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	configDir := filepath.Join(dir, "config")
	if err = os.Mkdir(configDir, 0755); err != nil {
		t.Fatal(err)
	}
	c := testConfig(t)
	for name, raw := range c.Files {
		if err = os.WriteFile(filepath.Join(configDir, name), raw, 0644); err != nil {
			t.Fatal(err)
		}
	}
	var doc map[string]any
	_ = json.Unmarshal(c.Files["config.json"], &doc)
	doc["parameters"].(map[string]any)["baseSpinWinProbability"] = .3
	raw, _ := json.Marshal(doc)
	_ = os.WriteFile(filepath.Join(configDir, "config.json"), raw, 0644)
	out := filepath.Join(dir, "release")
	if err = Publish(configDir, baseCandidate, freeCandidate, out); err != nil {
		t.Fatal(err)
	}
	if _, err = Load(out, filepath.Join(out, "base-library"), filepath.Join(out, "free-library"), Options{}); err != nil {
		t.Fatal(err)
	}
	after, _ := os.ReadFile(filepath.Join(baseCandidate, "manifest.json"))
	if string(before) != string(after) {
		t.Fatal("source manifest changed")
	}
	if err = Publish(configDir, baseCandidate, freeCandidate, out); err == nil {
		t.Fatal("release overwritten")
	}
	// One changed byte breaks its immutable release binding.
	path := filepath.Join(out, "base-library", "library.json")
	data, _ := os.ReadFile(path)
	_ = os.WriteFile(path, append(data, ' '), 0644)
	if _, err = Load(out, filepath.Join(out, "base-library"), filepath.Join(out, "free-library"), Options{}); err == nil {
		t.Fatal("altered release hash accepted")
	}
	// New numerical edits cannot silently reuse a release manifest.
	path = filepath.Join(out, "config.json")
	_ = os.WriteFile(path, append(raw, ' '), 0644)
	loaded, err := LoadConfig(out)
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err = LoadLibrary(loaded, "free", filepath.Join(out, "free-library")); err == nil {
		t.Fatal("wrong config hash accepted")
	}
}
