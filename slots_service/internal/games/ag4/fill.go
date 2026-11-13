package ag4

import (
	"fmt"
	"math/big"
	"strconv"

	"aislots/slots_service/internal/rules/paylines"
)

func symbolID(key string) (int, error) { return strconv.Atoi(key) }

// validateFillable rejects an incomplete line consisting of two Wilds: no
// ordinary completion can avoid adding a win. Ordinary holes are never Wild,
// so this obstruction cannot be introduced while filling a valid skeleton.
func validateFillable(c paylines.Config, board []int) error {
	wild := map[int]bool{}
	for _, s := range c.Symbols {
		wild[s.ID] = s.Role == "wild"
	}
	for _, line := range c.Lines {
		blanks, wilds := 0, 0
		for _, cell := range line {
			if board[cell-1] == 0 {
				blanks++
			} else if wild[board[cell-1]] {
				wilds++
			}
		}
		if blanks > 0 && wilds == 2 {
			return fmt.Errorf("AG4 skeleton has an unfillable double-Wild line %v", line)
		}
	}
	return nil
}

// legalFill checks only lines containing this hole. An incomplete line is
// safe unless it leaves two Wilds for the final cell. A completed line must
// contain two different ordinary symbols, so it cannot produce any award.
func (r *Runtime) legalFill(board []int, pos, id int) bool {
	for _, line := range r.config.Rules.Lines {
		contains := false
		for _, cell := range line {
			contains = contains || cell == pos+1
		}
		if !contains {
			continue
		}
		blanks, wilds, ordinary := 0, 0, 0
		different := false
		for _, cell := range line {
			v := board[cell-1]
			if cell == pos+1 {
				v = id
			}
			if v == 0 {
				blanks++
			} else if r.wild[v] {
				wilds++
			} else if ordinary == 0 {
				ordinary = v
			} else if ordinary != v {
				different = true
			}
		}
		if (blanks > 0 && wilds == 2) || (blanks == 0 && !different) {
			return false
		}
	}
	return true
}

func (r *Runtime) fillCell(board []int, pos int, allowWild bool, rng random) (int, error) {
	pool := weighted{total: new(big.Int)}
	for i, key := range r.symbols.keys {
		id, err := symbolID(key)
		if err != nil {
			return 0, err
		}
		if (!allowWild && r.wild[id]) || !r.legalFill(board, pos, id) {
			continue
		}
		pool.keys = append(pool.keys, key)
		pool.weights = append(pool.weights, r.symbols.weights[i])
		pool.total.Add(pool.total, r.symbols.weights[i])
	}
	if pool.total.Sign() == 0 {
		return 0, fmt.Errorf("AG4 constrained fill has no candidate at cell %d", pos+1)
	}
	key, err := pool.pick(rng)
	if err != nil {
		return 0, err
	}
	return symbolID(key)
}
