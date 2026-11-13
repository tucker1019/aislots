package ag4

import (
	"aislots/slots_service/internal/rules/paylines"
	"encoding/json"
	"os"
	"reflect"
	"strconv"
	"testing"
)

func TestMathToolExportParity(t *testing.T) {
	raw, err := os.ReadFile("../../../testdata/ag4-parity.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixtures struct {
		Cases []struct {
			Board []int
			Raw   string
			Bonus int
			Stake int64
			Win   string
			Wins  []paylines.Win
		}
		SkeletonCases []struct {
			Mode     string
			Skeleton Skeleton
			Valid    bool
			Key      string
			Boards   [][]int
		}
	}
	if err = json.Unmarshal(raw, &fixtures); err != nil {
		t.Fatal(err)
	}
	c, err := LoadConfig(release)
	if err != nil {
		t.Fatal(err)
	}
	for _, test := range fixtures.Cases {
		result, bonus, raw, err := Evaluate(c.Rules, test.Board)
		if err != nil || bonus != test.Bonus || raw != test.Raw || !reflect.DeepEqual(result.Wins, test.Wins) {
			t.Fatal("math tool payline mismatch", test, result, bonus, raw, err)
		}
		win, err := payout(test.Stake, raw)
		if err != nil || json.Number(test.Win).String() != strconv.FormatInt(win, 10) {
			t.Fatal("math tool payout mismatch", test, win, err)
		}
	}
	for _, test := range fixtures.SkeletonCases {
		seq, key, err := Inspect(c.Rules, test.Skeleton, test.Mode)
		if (err == nil) != test.Valid {
			t.Fatal("math tool skeleton acceptance mismatch", test, err)
		}
		if test.Valid && (key != test.Key || !reflect.DeepEqual(seq.Boards, test.Boards)) {
			t.Fatal("math tool skeleton replay mismatch", test, seq, key)
		}
	}
}
