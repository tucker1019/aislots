package ag4

import (
	"fmt"
	"reflect"

	"aislots/slots_service/internal/rules/paylines"
)

// normal fills only holes, with ordinary symbols. Each completed line must
// already have been a win in the fixed skeleton; no completed line is changed.
func (r *Runtime) normal(s Skeleton, key string, rng random) (Sequence, error) {
	reference, actual, err := Inspect(r.config.Rules, s, "base")
	if err != nil || actual != key {
		return Sequence{}, fmt.Errorf("invalid selected skeleton")
	}
	fixed := reference.Boards[0]
	if err := validateFillable(r.config.Rules, fixed); err != nil {
		return Sequence{}, err
	}
	before, _, _, _ := Evaluate(r.config.Rules, fixed)
	board := append([]int(nil), fixed...)
	for pos, id := range board {
		if id != 0 {
			continue
		}
		id, err := r.fillCell(board, pos, false, rng)
		if err != nil {
			return Sequence{}, err
		}
		board[pos] = id
	}
	result, _, raw, err := Evaluate(r.config.Rules, board)
	if err != nil {
		return Sequence{}, err
	}
	if raw != key || !reflect.DeepEqual(result.Wins, before.Wins) {
		return Sequence{}, fmt.Errorf("AG4 constrained fill invariant violated")
	}
	return Sequence{Boards: [][]int{board}, Added: [][]int{{}}}, nil
}

// zero constructs a single sequence. There is deliberately no rejection of
// generated boards/sequences and no library access on either zero path.
func (r *Runtime) zero(mode string, rng random) (Sequence, error) {
	var seq Sequence
	switch mode {
	case "base":
		board := make([]int, 9)
		// Column-major: 1,2,3 then 4,5,6 then 7,8,9. Avoid double
		// Wild prefixes before the third column; complete lines only if losing.
		for pos := range board {
			id, err := r.fillCell(board, pos, true, rng)
			if err != nil {
				return seq, err
			}
			board[pos] = id
		}
		seq = Sequence{Boards: [][]int{board}, Added: [][]int{{}}}
	case "free":
		target, err := r.targets.pick(rng)
		if err != nil {
			return seq, err
		}
		id, err := symbolID(target)
		if err != nil {
			return seq, err
		}
		seq.Target = &id
		board := make([]int, 9)
		seq.Boards = [][]int{append([]int(nil), board...)}
		seq.Added = [][]int{{}}
		// Three horizontal lines bound a losing board to six locked cells.
		// At most six rounds can add cells, followed by the no-addition round.
		for stage := 0; stage < 7; stage++ {
			added := []int{}
			for pos, v := range board {
				if v != 0 || !r.legalFill(board, pos, id) {
					continue
				}
				fill, err := rng.chance(string(r.config.Feature.FillProbability))
				if err != nil {
					return seq, err
				}
				if fill {
					board[pos] = id
					added = append(added, pos+1)
				}
			}
			seq.Boards = append(seq.Boards, append([]int(nil), board...))
			seq.Added = append(seq.Added, added)
			if len(added) == 0 {
				break
			}
		}
	default:
		return seq, fmt.Errorf("invalid AG4 zero mode")
	}
	raw, _, err := validateSequence(r.config.Rules, mapZeroMode(mode), seq)
	if err != nil {
		return seq, err
	}
	if raw != "0" {
		return seq, fmt.Errorf("AG4 constrained zero invariant violated")
	}
	return seq, nil
}

func mapZeroMode(mode string) string {
	if mode == "free" {
		return "respin"
	}
	return mode
}

func validateSequence(c paylines.Config, mode string, seq Sequence) (string, int, error) {
	if len(seq.Boards) == 0 || len(seq.Boards) != len(seq.Added) {
		return "", 0, fmt.Errorf("invalid AG4 sequence")
	}
	if mode == "base" {
		if len(seq.Boards) != 1 || seq.Target != nil || len(seq.Added[0]) != 0 {
			return "", 0, fmt.Errorf("invalid normal sequence")
		}
		for _, id := range seq.Boards[0] {
			if id == 0 {
				return "", 0, fmt.Errorf("unfilled normal board")
			}
		}
	} else if mode == "respin" {
		if len(seq.Boards) < 2 || len(seq.Boards) > 11 || len(seq.Added[0]) != 0 {
			return "", 0, fmt.Errorf("invalid respin sequence")
		}
		skeleton := Skeleton{Target: seq.Target}
		for i := 1; i < len(seq.Boards); i++ {
			if len(seq.Boards[i]) != 9 {
				return "", 0, fmt.Errorf("invalid respin board")
			}
			pairs := []int{}
			for _, pos := range seq.Added[i] {
				if pos < 1 || pos > 9 {
					return "", 0, fmt.Errorf("invalid added position")
				}
				pairs = append(pairs, pos-1, seq.Boards[i][pos-1])
			}
			skeleton.Stages = append(skeleton.Stages, pairs)
		}
		expected, _, err := Inspect(c, skeleton, "free")
		if err != nil {
			return "", 0, err
		}
		if !reflect.DeepEqual(expected.Boards, seq.Boards) {
			return "", 0, fmt.Errorf("respin changed locked cells")
		}
	} else {
		return "", 0, fmt.Errorf("unknown AG4 mode")
	}
	_, bonus, raw, err := Evaluate(c, seq.Boards[len(seq.Boards)-1])
	return raw, bonus, err
}
