package bootstrap

import (
	"aislots/slots_service/internal/engine"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type testRules struct{ kind, version string }

func (r testRules) Type() string    { return r.kind }
func (r testRules) Version() string { return r.version }
func (r testRules) Spin(context.Context, engine.SpinRequest) (engine.SpinResult, error) {
	return engine.SpinResult{}, nil
}

type closeCount struct{ calls int }

func (c *closeCount) Close() error { c.calls++; return nil }
func TestRulesFactoryDispatchAndPinnedVersion(t *testing.T) {
	ways, lines := &closeCount{}, &closeCount{}
	factories := map[string]Factory{
		"ways_cascade_v1": func(c GameConfig) (LoadedGame, error) {
			return LoadedGame{GameID: "AG1", Engine: testRules{c.RuleType, c.RuleType + ":abc"}, Closer: ways}, nil
		},
		"paylines_v1": func(c GameConfig) (LoadedGame, error) {
			return LoadedGame{GameID: "AG1", Engine: testRules{c.RuleType, c.RuleType + ":def"}, Closer: lines}, nil
		},
	}
	catalog, err := LoadCatalogWithFactories(Config{Games: []GameConfig{ruleSpec(t, "ways_cascade_v1", true), ruleSpec(t, "paylines_v1", false)}}, factories)
	if err != nil {
		t.Fatal(err)
	}
	current, err := catalog.Resolve("AG1", "")
	if err != nil || current.Type() != "ways_cascade_v1" {
		t.Fatal("wrong current factory", err)
	}
	pinned, err := catalog.Resolve("AG1", "paylines_v1:def")
	if err != nil || pinned.Type() != "paylines_v1" {
		t.Fatal("wrong pinned rules", err)
	}
	if catalog.Count() != 1 {
		t.Fatal("versions counted as separate games")
	}
	if err = catalog.Close(); err != nil {
		t.Fatal(err)
	}
	if ways.calls != 1 || lines.calls != 1 {
		t.Fatal("resources leaked")
	}
}
func TestUnknownRulesNeverFallBack(t *testing.T) {
	for _, kind := range []string{"", "paylines_v1", "typo"} {
		_, err := LoadCatalog(Config{Games: []GameConfig{ruleSpec(t, kind, true)}})
		if err == nil || (kind == "paylines_v1" && !strings.Contains(err.Error(), "unsupported ruleType")) {
			t.Fatal("unknown rules reached Ways loader", kind, err)
		}
	}
}
func TestFactoryFailureClosesEarlierGames(t *testing.T) {
	closed := &closeCount{}
	factories := map[string]Factory{"test_v1": func(c GameConfig) (LoadedGame, error) {
		return LoadedGame{GameID: "A", Engine: testRules{"test_v1", "test_v1:one"}, Closer: closed}, nil
	}}
	if _, err := LoadCatalogWithFactories(Config{Games: []GameConfig{ruleSpec(t, "test_v1", true), ruleSpec(t, "unknown_v1", false)}}, factories); err == nil {
		t.Fatal("unknown accepted")
	}
	if closed.calls != 1 {
		t.Fatal("failed startup leaked resources")
	}
}
func TestFactoryCannotMislabelRules(t *testing.T) {
	closed := &closeCount{}
	_, err := LoadCatalogWithFactories(Config{Games: []GameConfig{ruleSpec(t, "lines_v1", true)}}, map[string]Factory{"lines_v1": func(GameConfig) (LoadedGame, error) {
		return LoadedGame{GameID: "A", Engine: testRules{"ways_cascade_v1", "ways_cascade_v1:abc"}, Closer: closed}, nil
	}})
	if err == nil || closed.calls != 1 {
		t.Fatal("mismatched validator accepted", err)
	}
}

func ruleSpec(t *testing.T, kind string, current bool) GameConfig {
	t.Helper()
	dir := t.TempDir()
	raw, err := json.Marshal(map[string]any{"version": 1, "ruleType": kind})
	if err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(filepath.Join(dir, "config.json"), raw, 0600); err != nil {
		t.Fatal(err)
	}
	return GameConfig{ConfigDir: dir, Current: current}
}
