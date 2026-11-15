package ag8

import (
	"fmt"
	"math/big"
	"reflect"
	"strconv"
)

func validateFillable(c Rules, board []int) error {
	for _, line := range c.Lines {
		blanks, wilds := 0, 0
		for _, p := range line {
			if board[p-1] == 0 {
				blanks++
			}
			if board[p-1] == 7 {
				wilds++
			}
		}
		if blanks > 0 && wilds == 2 {
			return fmt.Errorf("AG8 unfillable double-Wild line")
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
		different, incomplete := false, false
		for _, p := range line {
			v := board[p-1]
			if p == pos+1 {
				v = id
			}
			if v == 0 {
				incomplete = true
			} else if v != 7 {
				if ordinary == 0 {
					ordinary = v
				} else if ordinary != v {
					different = true
				}
			}
		}
		if !incomplete && !different {
			return false
		}
	}
	return true
}

// Filter all legal ordinary candidates, then sample once per hole. No board
// retries, backtracking, replacement skeleton or neighboring multiplier.
func (r *Runtime) fillHoles(board []int, rng random) error {
	if err := validateFillable(r.config.Rules, board); err != nil {
		return err
	}
	for pos, id := range board {
		if id != 0 {
			continue
		}
		pool := weighted{total: new(big.Int)}
		for i, key := range r.normals.keys {
			symbol, _ := strconv.Atoi(key)
			if r.legalFill(board, pos, symbol) {
				pool.keys = append(pool.keys, key)
				pool.weights = append(pool.weights, r.normals.weights[i])
				pool.total.Add(pool.total, r.normals.weights[i])
			}
		}
		if pool.total.Sign() <= 0 {
			return fmt.Errorf("AG8 single-pass fill has no candidate")
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
	if err = r.fillHoles(board, rng); err != nil {
		return nil, err
	}
	after, err := evaluate(r.config.Rules, board, mode)
	if err != nil || !reflect.DeepEqual(before, after) {
		return nil, fmt.Errorf("AG8 fill changed award: %v", err)
	}
	return board, nil
}
func (r *Runtime) loss(mode string, rng random) ([]int, error) {
	if mode != "base" && mode != "free" {
		return nil, fmt.Errorf("invalid AG8 loss mode")
	}
	board := make([]int, 9)

	if err := r.fillHoles(board, rng); err != nil {
		return nil, err
	}
	e, err := evaluate(r.config.Rules, board, mode)
	if err != nil || e.RawPayout != 0 {
		return nil, fmt.Errorf("AG8 live loss invariant: %v", err)
	}
	return board, nil
}
