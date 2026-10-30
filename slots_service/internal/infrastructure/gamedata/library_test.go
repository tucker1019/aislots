package gamedata

import (
	"aislots/slots_service/internal/engine"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func writeBatch(t *testing.T, g engine.Game, mode engine.Mode, data string) string {
	t.Helper()
	dir := t.TempDir()
	hash := sha256.Sum256([]byte(data))
	config, _ := json.Marshal(g.Board)
	configHash := sha256.Sum256(config)
	m := map[string]any{"version": 1, "format": "winning-skeleton-v1", "gameId": g.ID, "mode": mode, "multiplierUnit": "raw-before-line-count", "positionOrder": "column-major-top-to-bottom-zero-based", "dataHash": hex.EncodeToString(hash[:]), "configHash": hex.EncodeToString(configHash[:]), "config": json.RawMessage(config)}
	raw, _ := json.MarshalIndent(m, "", "  ")
	if err := os.WriteFile(filepath.Join(dir, "manifest.json"), raw, 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "library.json"), []byte(data), 0600); err != nil {
		t.Fatal(err)
	}
	return dir
}
func TestDiskLibraryOffsetsAndChecksums(t *testing.T) {
	g := engine.Game{ID: "TEST", Board: engine.BoardConfig{Version: 1, ColumnHeights: []int{2, 2, 2}, Symbols: []engine.Symbol{{ID: "1", Role: "normal", Payouts: map[int]json.Number{3: "2"}}}, CascadeFactors: []json.Number{"1"}, FreeCascadeFactors: []json.Number{"2"}, Gold: engine.Gold{Columns: []int{}}}}
	dir := writeBatch(t, g, engine.Base, "{\n \"2\": [ [3,0,1,2,1,4,1,0],\n [3,1,1,3,1,5,1,0] ]\n}")
	d, err := OpenDiskLibrary(dir, "")
	if err != nil {
		t.Fatal(err)
	}
	defer d.Close()
	if err = d.CheckCompatibility(g); err != nil {
		t.Fatal(err)
	}
	for i, want := range [][]int{{3, 0, 1, 2, 1, 4, 1, 0}, {3, 1, 1, 3, 1, 5, 1, 0}} {
		got, err := d.Read(context.Background(), engine.Base, "2", i)
		if err != nil || !reflect.DeepEqual(got, want) {
			t.Fatal(got, err)
		}
	}
	if err = os.WriteFile(filepath.Join(dir, "library.json"), []byte("{}"), 0600); err != nil {
		t.Fatal(err)
	}
	if other, err := OpenDiskLibrary(dir, ""); err == nil {
		other.Close()
		t.Fatal("checksum mismatch accepted")
	}
}
