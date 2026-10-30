package engine

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"reflect"
	"testing"
)

func TestTSGoldParity(t *testing.T) {
	raw, err := os.ReadFile("testdata/ts-gold.json")
	if err != nil {
		t.Fatal(err)
	}
	var f struct {
		Board BoardConfig
		Cases []struct {
			Mode        Mode
			Interior    bool
			Skeleton    []int
			Key         string
			Wins        [][]Win
			Transformed [][]int
		}
	}
	if err = json.Unmarshal(raw, &f); err != nil {
		t.Fatal(err)
	}
	g, m := fixture()
	g.Board = f.Board
	e := engine(t, g, m)
	for _, c := range f.Cases {
		reference, err := e.decode(context.Background(), c.Skeleton, c.Mode, c.Key)
		if err != nil {
			t.Fatal(c.Mode, c.Interior, err)
		}
		if len(reference.Steps) != len(c.Wins) {
			t.Fatal("cascade length")
		}
		for i, s := range reference.Steps {
			for j, w := range s.Wins {
				want := c.Wins[i][j]
				if w.Symbol != want.Symbol || w.Columns != want.Columns || w.Ways != want.Ways || !reflect.DeepEqual(w.CellIDs, want.CellIDs) {
					t.Fatal("TS/Go winners differ")
				}
			}
			if !bytes.Equal(mustJSON(s.Transformed), mustJSON(c.Transformed[i])) && len(s.Transformed)+len(c.Transformed[i]) > 0 {
				t.Fatal("gold conversion differs")
			}
		}
		round, err := e.fill(context.Background(), reference, c.Mode, 0, &random{source: seeded(33)})
		if err != nil {
			t.Fatal(err)
		}
		if err = e.validateRound(round, c.Mode); err != nil {
			t.Fatal(err)
		}
	}
}
func mustJSON(v any) []byte { b, _ := json.Marshal(v); return b }
