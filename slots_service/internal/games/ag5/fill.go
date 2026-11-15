package ag5

import (
	"fmt"
	"math/big"
	"reflect"
	"strconv"
)

func validateFillable(c Rules, board []int) error {
	wild := map[int]bool{}
	for _, s := range c.Symbols {
		wild[s.ID] = s.Role == "wild"
	}
	for _, line := range c.Lines {
		blanks, wilds := 0, 0
		for _, p := range line {
			if board[p-1] == 0 {
				blanks++
			} else if wild[board[p-1]] {
				wilds++
			}
		}
		if blanks > 0 && wilds == 2 {
			return fmt.Errorf("AG5 unfillable double-Wild line %v", line)
		}
	}
	return nil
}
func (r *Runtime) legalFill(board []int, pos, id int) bool {
	for _, line := range r.config.Rules.Lines {
		contains := false
		for _, p := range line {
			contains = contains || p == pos+1
		}
		if !contains {
			continue
		}
		ordinary := 0
		different, incomplete, blocked := false, false, false
		for _, p := range line {
			v := board[p-1]
			if p == pos+1 {
				v = id
			}
			if v == 0 {
				incomplete = true
			} else if r.rewardIDs[v] {
				blocked = true
			} else if !r.wild[v] {
				if ordinary == 0 {
					ordinary = v
				} else if ordinary != v {
					different = true
				}
			}
		}
		if !incomplete && !blocked && !different {
			return false
		}
	}
	return true
}

// fillHoles filters before sampling. Each hole is assigned exactly once. There
// is no retry, rejection sampling of symbols, backtracking or alternate bucket.
func (r *Runtime) fillHoles(board []int, rng random) error {
	if err := validateFillable(r.config.Rules, board); err != nil {
		return err
	}
	for pos := range board {
		if board[pos] != 0 {
			continue
		}
		pool := weighted{total: new(big.Int)}
		for i, key := range r.normals.keys {
			id, _ := strconv.Atoi(key)
			if !r.legalFill(board, pos, id) {
				continue
			}
			pool.keys = append(pool.keys, key)
			pool.weights = append(pool.weights, r.normals.weights[i])
			pool.total.Add(pool.total, r.normals.weights[i])
		}
		if pool.total.Sign() <= 0 {
			return fmt.Errorf("AG5 fill invariant: no candidate at %d", pos+1)
		}
		key, err := pool.pick(rng)
		if err != nil {
			return err
		}
		board[pos], _ = strconv.Atoi(key)
	}
	return nil
}
func (r *Runtime) fill(s Skeleton, mode string, rng random) ([]int, error) {
	board, before, err := Inspect(r.config.Rules, s, mode)
	if err != nil {
		return nil, err
	}
	if mode == "base" {
		if err = r.fillHoles(board, rng); err != nil {
			return nil, err
		}
	}
	after, err := evaluate(r.config.Rules, board, mode)
	if err != nil || !reflect.DeepEqual(before, after) {
		return nil, fmt.Errorf("AG5 fill changed award: %v", err)
	}
	return board, nil
}
func (r *Runtime) loss(mode string, rng random) ([]int, error) {
	board := make([]int, 10)
	key, err := r.lossCounts.pick(rng)
	if err != nil {
		return nil, err
	}
	count, _ := strconv.Atoi(key)
	positions := []int{0, 1, 2, 3, 4, 5, 6, 7, 8, 9}
	for i := 0; i < count; i++ {
		index, err := rng.index(len(positions))
		if err != nil {
			return nil, err
		}
		pos := positions[index]
		positions = append(positions[:index], positions[index+1:]...)
		id, err := r.rewards.pick(rng)
		if err != nil {
			return nil, err
		}
		board[pos], _ = strconv.Atoi(id)
	}
	if mode == "base" {
		if err = r.fillHoles(board, rng); err != nil {
			return nil, err
		}
	}
	e, err := evaluate(r.config.Rules, board, mode)
	if err != nil || e.RawPayout != 0 {
		return nil, fmt.Errorf("AG5 live loss invariant: %v", err)
	}
	return board, nil
}
