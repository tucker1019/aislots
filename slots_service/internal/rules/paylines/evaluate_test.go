package paylines

import (
	"encoding/json"
	"os"
	"testing"
)

// Shared examples use the same column-major positions and client IDs as TS.
func TestPaylineExamples(t *testing.T) {
	raw, err := os.ReadFile("../../../../game_configs/AG4/paylines.json")
	if err != nil {
		t.Fatal(err)
	}
	var config Config
	if err = json.Unmarshal(raw, &config); err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		board []int
		raw   string
		wins  int
	}{
		{[]int{1, 0, 0, 7, 0, 0, 1, 0, 0}, "3", 1},
		{[]int{7, 0, 0, 7, 0, 0, 7, 0, 0}, "250", 1},
		{[]int{1, 2, 3, 1, 2, 3, 1, 2, 3}, "16", 3},
		{[]int{1, 1, 1, 1, 1, 1, 1, 1, 1}, "15", 5},
		{[]int{0, 0, 0, 0, 0, 0, 0, 0, 0}, "0", 0},
	}
	for _, test := range cases {
		result, err := Evaluate(config, test.board)
		if err != nil || result.RawPayout != test.raw || len(result.Wins) != test.wins {
			t.Fatal(test, result, err)
		}
	}
}
