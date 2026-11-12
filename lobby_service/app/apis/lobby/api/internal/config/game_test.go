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

func TestGameDisplayMetricsDefaultsAndValidation(t *testing.T) {
	t.Setenv("LOBBY_GAME_SERVICE_TOKEN", "")
	for _, tc := range []struct {
		fields string
		valid  bool
	}{
		{``, true}, {`,"volatility":"medium_low"`, true}, {`,"volatility":"medium_high"`, true}, {`,"volatility":"high"`, true}, {`,"maxWin":9007199254740992`, false}, {`,"theoreticalRtp":null`, false}, {`,"volatility":""`, false}, {`,"maxWin":null`, false}, {`,"theoreticalRtp":96.5,"volatility":"extreme","maxWin":5000`, true},
		{`,"theoreticalRtp":0,"volatility":"low","maxWin":-1`, true},
		{`,"theoreticalRtp":101`, false}, {`,"theoreticalRtp":-1`, false},
		{`,"volatility":"unknown"`, false}, {`,"maxWin":0`, false}, {`,"maxWin":-2`, false}, {`,"maxWin":1.5`, false},
	} {
		p := filepath.Join(t.TempDir(), "games.json")
		doc := `{"appname":"lobby","appkey":"web","country":"ID","currency":"IDR","games":{"AG1":{"name":"one"` + tc.fields + `}}}`
		if err := os.WriteFile(p, []byte(doc), 0600); err != nil {
			t.Fatal(err)
		}
		c, err := LoadGames(p)
		if (err == nil) != tc.valid {
			t.Fatalf("fields %s: %v", tc.fields, err)
		}
		if err == nil && tc.fields == "" {
			b, _ := json.Marshal(c.Games["AG1"])
			var g map[string]interface{}
			_ = json.Unmarshal(b, &g)
			if g["theoreticalRtp"] != float64(97) || g["volatility"] != "medium" || g["maxWin"] != float64(-1) {
				t.Fatalf("missing defaults: %s", b)
			}
		}
	}
}
