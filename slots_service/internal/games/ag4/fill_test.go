package ag4

import (
	"encoding/json"
	"errors"
	"io"
	"reflect"
	"testing"

	"aislots/slots_service/internal/rules/paylines"
)

// The old rejection algorithm repeatedly produced a winning board with this
// stream. The constrained algorithm must succeed with one draw per hole.
type zeroReader struct{ calls int }

func (r *zeroReader) Read(p []byte) (int, error) {
	r.calls++
	clear(p)
	return len(p), nil
}

func TestEveryNormalSkeletonFillsOnceWithoutAdditionalWins(t *testing.T) {
	c, base, free := fixture(t)
	r := runtime(t, c, base, free)
	count := 0
	for key, list := range base {
		for index, skeleton := range list {
			reference, _, err := Inspect(c.Rules, skeleton, "base")
			if err != nil {
				t.Fatal(err)
			}
			fixed := reference.Boards[0]
			before, _, _, _ := Evaluate(c.Rules, fixed)
			stream := &zeroReader{}
			seq, err := r.normal(skeleton, key, random{stream})
			if err != nil {
				t.Fatalf("bucket %s skeleton %d: %v", key, index, err)
			}
			board := seq.Boards[0]
			holes := 0
			for pos, id := range fixed {
				if id != 0 && board[pos] != id {
					t.Fatal("fixed skeleton changed", key, index, pos)
				}
				if id == 0 {
					holes++
					if board[pos] == 0 || r.wild[board[pos]] {
						t.Fatal("hole not filled with an ordinary symbol")
					}
				}
			}
			if stream.calls != holes {
				t.Fatalf("expected exactly one weighted draw per hole: %d != %d", stream.calls, holes)
			}
			after, _, raw, err := Evaluate(c.Rules, board)
			if err != nil || raw != key || !reflect.DeepEqual(before.Wins, after.Wins) {
				t.Fatal("additional/changed award", key, index, raw, err)
			}
			count++
		}
	}
	if count != 7048 {
		t.Fatal("not all production normal skeletons covered", count)
	}
}

func TestZeroGenerationSinglePassAndRespinProbabilityBoundaries(t *testing.T) {
	c, base, free := fixture(t)
	for _, probability := range []string{"0", "0.2", "1"} {
		c.Feature.FillProbability = json.Number(probability)
		r := runtime(t, c, base, free)
		// Explicitly disable all library lookup on zero paths.
		r.base, r.respin = nil, nil
		stream := &zeroReader{}
		seq, err := r.zero("base", random{stream})
		if err != nil || stream.calls != 9 {
			t.Fatal("normal zero must fill nine cells exactly once", seq, stream.calls, err)
		}
		stream = &zeroReader{}
		seq, err = r.zero("free", random{stream})
		if err != nil {
			t.Fatal("single-pass respin", probability, err)
		}
		if len(seq.Boards) > 8 || len(seq.Added[len(seq.Added)-1]) != 0 {
			t.Fatal("respin did not terminate within six additions and one empty round", seq)
		}
		if probability == "0" && len(seq.Boards) != 2 {
			t.Fatal("zero probability should terminate immediately")
		}
		locked := 0
		for _, board := range seq.Boards {
			_, _, raw, err := Evaluate(c.Rules, board)
			if err != nil || raw != "0" {
				t.Fatal("intermediate respin has a win", board, err)
			}
		}
		for _, id := range seq.Boards[len(seq.Boards)-1] {
			if id != 0 {
				locked++
			}
		}
		if probability == "1" && locked != 6 {
			t.Fatal("100% legal filling should lock six cells", locked)
		}
	}
}

func TestConstrainedCandidateExclusionsAndDoubleWildSkeleton(t *testing.T) {
	c, base, free := fixture(t)
	r := runtime(t, c, base, free)
	board := []int{1, 0, 2, 1, 2, 0, 0, 0, 0}
	// Cell 7 closes 1-4-7 and 3-5-7. Both ordinary matches and Wild lose eligibility.
	for _, id := range []int{1, 2, 7} {
		if r.legalFill(board, 6, id) {
			t.Fatal("additional winning symbol allowed at 7", id)
		}
	}
	for _, id := range []int{3, 4, 5, 6} {
		if !r.legalFill(board, 6, id) {
			t.Fatal("legal ordinary symbol excluded", id)
		}
	}
	board = []int{7, 0, 0, 0, 0, 0, 0, 0, 0}
	for _, pos := range []int{3, 4} {
		if r.legalFill(board, pos, 7) {
			t.Fatal("second-column double-Wild prefix allowed", pos)
		}
	}
	// Two existing winning lines use these Wilds, but the unfinished top
	// diagonal line can never be filled without adding a third win.
	board = []int{7, 0, 1, 1, 7, 0, 1, 0, 0}
	if err := validateFillable(c.Rules, board); err == nil {
		t.Fatal("unfillable skeleton accepted")
	}
	pairs := []int{}
	for pos, id := range board {
		if id != 0 {
			pairs = append(pairs, pos, id)
		}
	}
	skeleton := Skeleton{Stages: [][]int{pairs}}
	_, key, err := Inspect(c.Rules, skeleton, "base")
	if err != nil {
		t.Fatal("fixture must be a valid raw winning skeleton", err)
	}
	raw, _ := json.Marshal(Library{key: []Skeleton{skeleton}})
	if _, _, _, err := ValidateLibrary(c, "base", raw); err == nil {
		t.Fatal("unfillable skeleton accepted at library load")
	}
}

// Enumerate prefixes using three ordinary IDs and Wild, including all allowed
// Wild arrangements, and independently evaluate every third-column candidate.
// The positive-weight domain bound covers the full six-ordinary-symbol set.
func TestAllOrdinaryZeroPrefixesHaveLegalCompletions(t *testing.T) {
	c, err := LoadConfig(release)
	if err != nil {
		t.Fatal(err)
	}
	r := &Runtime{config: c, wild: map[int]bool{7: true}}
	board := make([]int, 9)
	var prefixes func(int)
	prefixes = func(pos int) {
		if pos == 6 {
			for hole := 6; hole < 9; hole++ {
				choices := 0
				for id := 1; id <= 7; id++ {
					if r.legalFill(board, hole, id) {
						choices++
						board[hole] = id
						result, err := paylines.Evaluate(c.Rules, board)
						if err != nil || len(result.Wins) != 0 {
							t.Fatal("third-column choice wins", board, err)
						}
						board[hole] = 0
					}
				}
				if choices == 0 {
					t.Fatal("prefix has no third-column candidate", board, hole)
				}
			}
			return
		}
		for _, id := range []int{1, 2, 3, 7} {
			if r.legalFill(board, pos, id) {
				board[pos] = id
				prefixes(pos + 1)
				board[pos] = 0
			}
		}
	}
	prefixes(0)
}

type failedReader struct{ err error }

func (r failedReader) Read([]byte) (int, error) { return 0, r.err }

func TestSinglePassRandomFailureIsReturned(t *testing.T) {
	c, base, free := fixture(t)
	r := runtime(t, c, base, free)
	for _, mode := range []string{"base", "free"} {
		_, err := r.zero(mode, random{failedReader{io.ErrUnexpectedEOF}})
		if !errors.Is(err, io.ErrUnexpectedEOF) {
			t.Fatal("random source failure hidden", mode, err)
		}
	}
}
