package ag4

import (
	"aislots/slots_service/internal/rules/paylines"
	"fmt"
)

type Skeleton struct {
	Target *int    `json:"target"`
	Stages [][]int `json:"stages"`
}
type Sequence struct {
	Target *int    `json:"target"`
	Boards [][]int `json:"boards"`
	Added  [][]int `json:"added"`
}

func Inspect(config paylines.Config, s Skeleton, mode string) (Sequence, string, error) {
	var out Sequence
	if (mode != "base" && mode != "free") || len(s.Stages) == 0 || len(s.Stages) > 10 {
		return out, "", fmt.Errorf("invalid AG4 skeleton")
	}
	board := make([]int, config.Size())
	out.Target = s.Target
	allowed := map[int]bool{}
	normal := map[int]bool{}
	for _, v := range config.Symbols {
		allowed[v.ID] = true
		normal[v.ID] = v.Role == "normal"
	}
	if mode == "base" {
		if s.Target != nil || len(s.Stages) != 1 {
			return out, "", fmt.Errorf("invalid normal skeleton")
		}
	} else {
		if s.Target == nil || !normal[*s.Target] {
			return out, "", fmt.Errorf("invalid respin target")
		}
		out.Boards = append(out.Boards, append([]int(nil), board...))
		out.Added = append(out.Added, []int{})
	}
	for index, pairs := range s.Stages {
		if len(pairs)%2 != 0 || len(pairs) > len(board)*2 {
			return out, "", fmt.Errorf("invalid stage pairs")
		}
		added := []int{}
		for i := 0; i < len(pairs); i += 2 {
			pos, id := pairs[i], pairs[i+1]
			if pos < 0 || pos >= len(board) || !allowed[id] || board[pos] != 0 || (mode == "free" && id != *s.Target) {
				return out, "", fmt.Errorf("invalid/overwritten skeleton cell")
			}
			board[pos] = id
			added = append(added, pos+1)
		}
		out.Boards = append(out.Boards, append([]int(nil), board...))
		out.Added = append(out.Added, added)
		if mode == "free" {
			full := true
			for _, id := range board {
				full = full && id != 0
			}
			last := index == len(s.Stages)-1
			if (last && !full && len(added) > 0) || (!last && (full || len(added) == 0)) {
				return out, "", fmt.Errorf("invalid respin termination")
			}
		}
	}
	result, _, key, err := Evaluate(config, board)
	if err != nil {
		return out, "", err
	}
	if mode == "base" {
		wins := map[int]bool{}
		for _, id := range result.WinningCellIDs {
			wins[id] = true
		}
		for pos, id := range board {
			if id != 0 && !wins[pos+1] {
				return out, "", fmt.Errorf("normal skeleton fixes nonwinning cell")
			}
		}
	}
	return out, key, nil
}
