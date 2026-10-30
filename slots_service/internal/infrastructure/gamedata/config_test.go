package gamedata

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadExistingGame(t *testing.T) {
	g, err := LoadGame("../../../../game_configs/AG1")
	if err != nil {
		t.Fatal(err)
	}
	if g.ID != "AG1" || len(g.BaseRows) == 0 || len(g.Board.Symbols) == 0 {
		t.Fatal("existing game not loaded")
	}
}

func TestReadRuleMetadataBeforeSpecificGameFiles(t *testing.T) {
	dir := t.TempDir()
	for _, entry := range []struct {
		data string
		kind string
		ok   bool
	}{
		{`{"version":1,"ruleType":"paylines_v1"}`, "paylines_v1", true},
		{`{"version":1,"ruleType":"ways_cascade_v1"}`, "ways_cascade_v1", true},
		{`{"version":1}`, "", false},
		{`{"version":1,"ruleType":"ways"}`, "", false},
	} {
		if err := os.WriteFile(filepath.Join(dir, "config.json"), []byte(entry.data), 0600); err != nil {
			t.Fatal(err)
		}
		kind, err := ReadRuleType(dir)
		if entry.ok {
			if err != nil || kind != entry.kind {
				t.Fatal(kind, err)
			}
		} else if err == nil {
			t.Fatal("missing/invalid type defaulted")
		}
	}
}
