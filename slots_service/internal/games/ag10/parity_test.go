package ag10

import (
	"encoding/json"
	"os"
	"reflect"
	"strconv"
	"testing"
)

func TestMathToolParity(t *testing.T) {
	raw, err := os.ReadFile("../../../testdata/ag10-parity.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixtures struct {
		Cases []struct {
			Mode              string
			Board             []int
			Raw, Line, Reward int64
			WinningCellIDs    []int
			Wins              []LineWin
			Stake             int64
			Win               string
		}
		SkeletonCases []struct {
			Mode     string
			Skeleton Skeleton
			Valid    bool
			Key      string
			Board    []int
		}
	}
	if err = json.Unmarshal(raw, &fixtures); err != nil {
		t.Fatal(err)
	}
	c := testConfig(t)
	for _, tc := range fixtures.Cases {
		e, err := Evaluate(c.Rules, tc.Board, tc.Mode)
		if err != nil || e.RawPayout != tc.Raw || e.LinePayout != tc.Line || e.RewardPayout != tc.Reward || !reflect.DeepEqual(e.LineWins, tc.Wins) || !reflect.DeepEqual(e.WinningCellIDs, tc.WinningCellIDs) {
			t.Fatal("math checker mismatch", tc, e, err)
		}
		amount, err := payout(tc.Stake, e.RawPayout)
		if err != nil || strconv.FormatInt(amount, 10) != tc.Win {
			t.Fatal("currency mismatch", tc, amount, err)
		}
	}
	r := testRuntime(t, Options{})
	for _, tc := range fixtures.SkeletonCases {
		board, e, err := Inspect(c.Rules, tc.Skeleton, tc.Mode)
		if (err == nil) != tc.Valid {
			t.Fatal("math skeleton acceptance mismatch", tc, err)
		}
		if tc.Valid {
			board, err = r.fill(tc.Skeleton, tc.Mode, random{&zeroReader{}})
			if err != nil || strconv.FormatInt(e.RawPayout, 10) != tc.Key || !reflect.DeepEqual(board, tc.Board) {
				t.Fatal("math one-pass fill mismatch", tc, board, err)
			}
		}
	}
}
