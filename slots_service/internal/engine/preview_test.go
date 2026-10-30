package engine

import (
	"context"
	"reflect"
	"testing"
)

func TestPreviewEntersNextBoardAndUnchangedColumnsKeepPreview(t *testing.T) {
	g, m := fixture()
	e := engine(t, g, m)
	for i := 0; i < 25; i++ {
		r, err := e.Spin(context.Background(), SpinRequest{BetMinorUnits: 200})
		if err != nil {
			t.Fatal(err)
		}
		p := r.Round.Previews
		if len(p) != len(r.Round.Steps)+1 {
			t.Fatal("missing stage previews")
		}
		for j, step := range r.Round.Steps {
			next := r.Round.Final
			if j+1 < len(r.Round.Steps) {
				next = r.Round.Steps[j+1].Before
			}
			for c, col := range step.Before {
				old := map[int]bool{}
				for _, cell := range col {
					old[cell.ID] = true
				}
				var added []Cell
				for _, cell := range next[c] {
					if !old[cell.ID] {
						added = append(added, cell)
					}
				}
				if len(added) > 0 {
					if p[j][c] != added[len(added)-1] {
						t.Fatalf("preview changed entering board: %+v", p[j][c])
					}
				} else if p[j][c] != p[j+1][c] {
					t.Fatal("unchanged column preview changed")
				}
				for _, cell := range col {
					if cell.ID == p[j][c].ID {
						t.Fatal("preview already in active board")
					}
				}
			}
		}
		replay, err := e.evaluate(r.Round.Final, Base, 0)
		if err != nil {
			t.Fatal(err)
		}
		if len(replay) != 0 {
			t.Fatal("terminal active board won")
		}
		if !reflect.DeepEqual(r.Round.Initial, r.Round.Steps[0].Before) {
			t.Fatal("preview mutated active board")
		}
	}
}
