package bootstrap

import (
	"aislots/slots_service/internal/application/bet"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestConfigPathsAndEmptyCatalog(t *testing.T) {
	c, err := LoadConfig("../../configs/server.example.json")
	if err != nil {
		t.Fatal(err)
	}
	catalog, err := LoadCatalog(c)
	if err != nil {
		t.Fatal(err)
	}
	defer catalog.Close()
	if catalog.Count() != 0 {
		t.Fatal("unexpected game")
	}
	if _, err := catalog.Resolve("AG1", ""); !errors.Is(err, bet.ErrGameUnavailable) {
		t.Fatal(err)
	}
	raw, err := os.ReadFile("../../configs/server.example.json")
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	file := filepath.Join(dir, "server.json")
	s := strings.Replace(string(raw), `"games": []`, `"games": [{"configDir":"game","baseLibraryDir":"base","freeLibraryDir":"free","triggerSymbolCount":3,"maxFillAttempts":64,"current":true}]`, 1)
	if err = os.WriteFile(file, []byte(s), 0600); err != nil {
		t.Fatal(err)
	}
	c, err = LoadConfig(file)
	if err != nil {
		t.Fatal(err)
	}
	if c.Games[0].ConfigDir != filepath.Join(dir, "game") {
		t.Fatal("relative paths not resolved")
	}
	s = strings.Replace(s, `"games":`, `"unknown": true, "games":`, 1)
	if err = os.WriteFile(file, []byte(s), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err = LoadConfig(file); err == nil {
		t.Fatal("unknown configuration accepted")
	}
}
