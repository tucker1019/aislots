package legacyways_test

import (
	"encoding/json"
	"reflect"
	"testing"

	game "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/engine"
	"aislots/slots_service/internal/games/ag1"
	"aislots/slots_service/internal/games/ag2"
	"aislots/slots_service/internal/games/ag3"
	"aislots/slots_service/internal/games/legacyways"
)

func TestModulePresentationPreservesLegacyLayouts(t *testing.T) {
	for _, test := range []struct {
		id      string
		heights []int
		preview int
		runtime *legacyways.Runtime
	}{
		{"AG1", []int{4, 4, 4, 4, 4}, 1, ag1.New(nil)},
		{"AG1", []int{5, 5, 5, 5, 5}, 0, ag1.New(nil)}, // historical five-active-row layout
		{"AG2", []int{4, 5, 5, 5, 4}, 1, ag2.New(nil)},
		{"AG3", []int{3, 4, 5, 5, 4, 3}, 1, ag3.New(nil)},
	} {
		t.Run(test.id+string(rune('0'+test.preview)), func(t *testing.T) {
			old := engine.SpinResult{GameID: test.id, Version: engine.RuleType + ":one", Mode: engine.Free, BetMinorUnits: 100, ExactWinMinorUnits: "0", NextState: engine.State{Version: engine.RuleType + ":one"}, Round: engine.Round{RawMultiplier: "0"}}
			for c, h := range test.heights {
				col := make([]engine.Cell, h)
				for r := range col {
					col[r] = engine.Cell{ID: c*10 + r + 1, Symbol: 1}
				}
				old.Round.Final = append(old.Round.Final, col)
			}
			preview := make([]engine.Cell, len(test.heights))
			for c := range preview {
				preview[c] = engine.Cell{ID: 100 + c, Symbol: 2}
			}
			old.Round.Previews = [][]engine.Cell{preview}
			out, err := legacyways.ImportResult(old, engine.RuleType)
			if err != nil {
				t.Fatal(err)
			}
			ctx := game.FrameContext{RoundID: "saved-bet", SpinIndex: 4}
			raw, err := test.runtime.Present(out, ctx)
			if err != nil {
				t.Fatal(err)
			}
			var shown legacyways.Display
			if err = json.Unmarshal(raw, &shown); err != nil {
				t.Fatal(err)
			}
			if shown.PreviewRows != test.preview || len(shown.BottomSymbols) != len(test.heights) {
				t.Fatal("changed preview/bottom layout", shown)
			}
			for c, h := range test.heights {
				if len(shown.Board[c]) != h+test.preview {
					t.Fatal("changed active rows")
				}
				if !reflect.DeepEqual(shown.Board[c][test.preview:], old.Round.Final[c]) {
					t.Fatal("changed active cells")
				}
				bottom := shown.BottomSymbols[c]
				gold := test.id != "AG3" && c == 2
				if (bottom >= 1000) != gold {
					t.Fatal("changed free bottom gold", shown.BottomSymbols)
				}
			}
			again, err := test.runtime.Present(out, ctx)
			if err != nil || string(raw) != string(again) {
				t.Fatal("presentation resampled persisted spin")
			}
		})
	}
}
