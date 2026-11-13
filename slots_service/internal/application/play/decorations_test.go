package play

import (
	"encoding/json"
	"reflect"
	"testing"
)

func TestBottomSymbolsFrameStateAndReplay(t *testing.T) {
	for _, game := range []string{"AG1", "AG2", "AG3"} {
		got := bottomSymbols(game, "bet-1", 0, true)
		columns := 5
		if game == "AG3" {
			columns = 6
		}
		if len(got) != columns || !reflect.DeepEqual(got, bottomSymbols(game, "bet-1", 0, true)) {
			t.Fatal("must retain five bottom cells through cascade")
		}
		if reflect.DeepEqual(got, bottomSymbols(game, "bet-1", 1, true)) {
			t.Fatal("new spin should sample its own bottom")
		}
		for c, id := range got {
			if id%1000 < 1 || id%1000 > 9 || (game != "AG3" && c == 2 && id < 1000) {
				t.Fatal("invalid symbol", got)
			}
		}
		original := Frame{BottomSymbols: got}
		for _, data := range []any{original, Status{LastFrame: &original}, ReplayFrame{Frame: original}} {
			raw, err := json.Marshal(data)
			if err != nil {
				t.Fatal(err)
			}
			var fields map[string]json.RawMessage
			if err = json.Unmarshal(raw, &fields); err != nil {
				t.Fatal(err)
			}
			if last, ok := fields["lastFrame"]; ok {
				if err = json.Unmarshal(last, &fields); err != nil {
					t.Fatal(err)
				}
			}
			var stored []int
			if err = json.Unmarshal(fields["bottomSymbols"], &stored); err != nil || !reflect.DeepEqual(stored, got) {
				t.Fatal("frame/state/replay lost bottom", string(raw), err)
			}
		}
		raw, _ := json.Marshal(original)
		var restored Frame
		if err := json.Unmarshal(raw, &restored); err != nil || !reflect.DeepEqual(restored.BottomSymbols, got) {
			t.Fatal("storage loses bottom")
		}
	}
	var old Frame
	if err := json.Unmarshal([]byte(`{"board":[]}`), &old); err != nil || old.BottomSymbols != nil {
		t.Fatal("legacy unsupported")
	}
	if bottomSymbols("AG4", "bet", 0, false) != nil {
		t.Fatal("unrelated game changed")
	}
}
