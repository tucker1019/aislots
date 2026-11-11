package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestGameCatalogVisibilityAndOfflineValidation(t *testing.T) {
	t.Setenv("LOBBY_GAME_SERVICE_TOKEN", "")
	visible := true
	valid := GameEntry{Visible: &visible, Name: "Future", Provider: "AG", Cover: "/assets/future.png", Sort: 10}
	load := func(id string, g GameEntry) error {
		t.Helper()
		doc, _ := json.Marshal(GameConfig{AppName: "lobby", AppKey: "web", Country: "ID", Currency: "IDR", Games: map[string]GameEntry{id: g}})
		p := filepath.Join(t.TempDir(), "games.json")
		if err := os.WriteFile(p, doc, 0600); err != nil {
			t.Fatal(err)
		}
		_, err := LoadGames(p)
		return err
	}
	if err := load("FUTURE", valid); err != nil {
		t.Fatal("offline entry should not require an address", err)
	}
	for _, patch := range []func(*GameEntry){func(g *GameEntry) { g.Enabled = true }, func(g *GameEntry) { g.Sort = -1 }, func(g *GameEntry) { g.Cover = "javascript:alert(1)" }, func(g *GameEntry) { g.Cover = "" }, func(g *GameEntry) { g.Name = "" }} {
		g := valid
		patch(&g)
		if load("FUTURE", g) == nil {
			t.Fatal("accepted invalid catalog entry", g)
		}
	}
	if load("../FUTURE", valid) == nil {
		t.Fatal("accepted unsafe game ID")
	}
}
