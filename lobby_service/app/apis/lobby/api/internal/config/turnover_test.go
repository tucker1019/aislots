package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestTurnoverDefaultsAndValidation(t *testing.T) {
	c, e := LoadTurnover("../../../../../../etc/turnover.json")
	if e != nil {
		t.Fatal(e)
	}
	for source, n := range c.Multipliers {
		want := int64(1)
		if source == "game_002" || source == "wdr_002" {
			want = 0
		}
		if n != want {
			t.Fatal(source, n, want)
		}
	}
	for _, change := range []func(*TurnoverConfig){func(c *TurnoverConfig) { c.Multipliers["rch_001"] = -1 }, func(c *TurnoverConfig) { delete(c.Multipliers, "act_001") }, func(c *TurnoverConfig) { c.Multipliers["game_002"] = 1 }, func(c *TurnoverConfig) { c.Multipliers["wdr_002"] = 1 }, func(c *TurnoverConfig) { c.Multipliers["new_unknown"] = 1 }, func(c *TurnoverConfig) { c.Version = "" }, func(c *TurnoverConfig) { c.Multipliers["rch_001"] = 1000001 }} {
		copy, e := LoadTurnover("../../../../../../etc/turnover.json")
		if e != nil {
			t.Fatal(e)
		}
		change(&copy)
		if e = copy.Validate(); e == nil {
			t.Fatal("invalid config accepted")
		}
	}
	c.Multipliers["rch_001"] = 0
	c.Multipliers["act_002"] = 2
	if e = c.Validate(); e != nil {
		t.Fatal(e)
	}
	path := filepath.Join(t.TempDir(), "turnover.json")
	b, _ := json.Marshal(c)
	for _, content := range []string{string(b) + " {}", `{"version":"v","multipliers":{},"extra":true}`, `{"version":"v","multipliers":{"rch_001":1.5}}`} {
		if e = os.WriteFile(path, []byte(content), 0600); e != nil {
			t.Fatal(e)
		}
		if _, e = LoadTurnover(path); e == nil {
			t.Fatal("malformed config accepted")
		}
	}
}
