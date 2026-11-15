package ag7

import (
	"bytes"
	"encoding/json"
	"os"
	"reflect"
	"strconv"
	"testing"
)

func TestMathToolParity(t *testing.T) {
	raw, err := os.ReadFile("../../../testdata/ag7-parity.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Cases []struct {
			Mode                string
			Board               []int
			Raw                 int64
			FullBoard           bool
			FullSymbolID        int
			FullBoardMultiplier int
			Jackpot             bool
			WinningCellIDs      []int
			Wins                []LineWin
			Stake               int64
			Win                 string
			Skeleton            *Skeleton
		}
		Lengths []struct {
			Raw          int64
			Draw, Losses int
		}
	}
	if err = json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	c, b, f := components(t)
	r, err := New(c, b, f, Options{})
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range fixture.Cases {
		e, err := Evaluate(c.Rules, tc.Board, tc.Mode)
		if err != nil || e.RawPayout != tc.Raw || e.Jackpot != tc.Jackpot || e.FullBoard != tc.FullBoard || e.FullSymbolID != tc.FullSymbolID || e.FullBoardMultiplier != tc.FullBoardMultiplier || !reflect.DeepEqual(e.LineWins, tc.Wins) || !reflect.DeepEqual(e.WinningCellIDs, tc.WinningCellIDs) {
			t.Fatal("TypeScript/Go evaluation mismatch", tc, e, err)
		}
		amount, err := payout(tc.Stake, e.RawPayout)
		if err != nil || strconv.FormatInt(amount, 10) != tc.Win {
			t.Fatal("money rounding mismatch", tc, amount, err)
		}
		if tc.Skeleton != nil {
			filled, err := r.fill(*tc.Skeleton, tc.Mode, random{&countReader{}})
			if err != nil || !reflect.DeepEqual(filled, tc.Board) {
				t.Fatal("TypeScript/Go single-pass fill mismatch", tc, filled, err)
			}
		}
	}
	for _, tc := range fixture.Lengths {
		n := tc.Draw - 1
		key, err := r.lengths.pick(random{bytes.NewReader([]byte{byte(n >> 8), byte(n)})})
		if err != nil || key != strconv.Itoa(tc.Losses) {
			t.Fatal("Lua/TypeScript/Go length mismatch", tc, key, err)
		}
	}
}
