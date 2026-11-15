package ag8

import (
	"encoding/json"
	"os"
	"reflect"
	"strconv"
	"testing"
)

type zeroReader struct{}

func (zeroReader) Read(p []byte) (int, error) { clear(p); return len(p), nil }

func TestMathToolParity(t *testing.T) {
	raw, err := os.ReadFile("../../../testdata/ag8-parity.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Cases []struct {
			Mode           string
			Board          []int
			Raw            int64
			WinningCellIDs []int
			Wins           []LineWin
			Stake          int64
			BuyMode        int
			Multipliers    []int64
			Win            string
			Skeleton       *Skeleton
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
		if err != nil || e.RawPayout != tc.Raw || !reflect.DeepEqual(e.LineWins, tc.Wins) || !reflect.DeepEqual(e.WinningCellIDs, tc.WinningCellIDs) {
			t.Fatal("TypeScript/Go evaluation mismatch", tc, e, err)
		}
		divisor := int64(5)
		if tc.BuyMode == 2 {
			divisor = 25
		}
		amount, err := payout(tc.Stake, min(e.RawPayout*sum(tc.Multipliers), 2500*divisor), divisor)
		if err != nil || strconv.FormatInt(amount, 10) != tc.Win {
			t.Fatal("monetary mismatch", tc, amount, err)
		}
		if tc.Skeleton != nil {
			filled, err := r.fill(*tc.Skeleton, tc.Mode, random{zeroReader{}})
			if err != nil || !reflect.DeepEqual(filled, tc.Board) {
				t.Fatal("TypeScript/Go single-pass fill mismatch", tc, filled, err)
			}
		}
	}
}
