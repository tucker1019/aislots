package engine

import (
	"context"
	"fmt"
	"math/big"
	"reflect"
	"sort"
	"strconv"
	"strings"
)

type definition struct {
	id, base int
	role     string
	weight   float64
	payouts  map[int]*big.Rat
}

func cloneBoard(b Board) Board {
	out := make(Board, len(b))
	for i := range b {
		out[i] = append([]Cell(nil), b[i]...)
	}
	return out
}
func flatten(b Board) []Cell {
	out := []Cell{}
	for _, col := range b {
		out = append(out, col...)
	}
	return out
}
func contains(values []int, n int) bool {
	for _, v := range values {
		if v == n {
			return true
		}
	}
	return false
}
func (e *Engine) factor(mode Mode, index int) *big.Rat {
	v := e.game.Board.CascadeFactors
	if mode == Free {
		v = e.game.Board.FreeCascadeFactors
	}
	if index >= len(v) {
		index = len(v) - 1
	}
	return mustRat(v[index].String())
}
func (e *Engine) evaluate(board Board, mode Mode, index int) ([]Win, error) {
	if len(board) != len(e.game.Board.ColumnHeights) {
		return nil, fmt.Errorf("board shape mismatch")
	}
	ids := map[int]bool{}
	for c, col := range board {
		if len(col) != e.game.Board.ColumnHeights[c] {
			return nil, fmt.Errorf("board height mismatch")
		}
		for _, cell := range col {
			d, ok := e.defs[cell.Symbol]
			if cell.ID < 1 || ids[cell.ID] || (!ok && cell.Symbol != 0) {
				return nil, fmt.Errorf("invalid board cell")
			}
			ids[cell.ID] = true
			if ok && d.id != d.base && !contains(e.game.Board.Gold.Columns, c+1) {
				return nil, fmt.Errorf("gold on forbidden reel")
			}
		}
	}
	wins := []Win{}
	for _, s := range e.normal {
		counts := []int{}
		cells := []int{}
		natural := false
		for _, col := range board {
			matched := []int{}
			for _, cell := range col {
				d := e.defs[cell.Symbol]
				if d != nil && (d.base == s.id || d.role == "wild") {
					matched = append(matched, cell.ID)
					if d.base == s.id {
						natural = true
					}
				}
			}
			if len(matched) == 0 {
				break
			}
			counts = append(counts, len(matched))
			cells = append(cells, matched...)
		}
		if len(counts) < 3 || !natural {
			continue
		}
		pay := s.payouts[len(counts)]
		if pay == nil || pay.Sign() == 0 {
			continue
		}
		ways := int64(1)
		for _, n := range counts {
			ways *= int64(n)
		}
		amount := new(big.Rat).Mul(pay, big.NewRat(ways, 1))
		amount.Mul(amount, e.factor(mode, index))
		wins = append(wins, Win{Symbol: s.id, Columns: len(counts), Counts: counts, Ways: ways, CellIDs: cells, RawPayout: decimal(amount)})
	}
	return wins, nil
}
func winSignature(wins []Win) string {
	parts := []string{}
	for _, w := range wins {
		ids := append([]int(nil), w.CellIDs...)
		sort.Ints(ids)
		parts = append(parts, fmt.Sprint(w.Symbol, ":", w.Columns, ":", w.Ways, ":", ids))
	}
	sort.Strings(parts)
	return strings.Join(parts, "|")
}
func (e *Engine) advance(before Board, wins []Win, nextID *int) Step {
	winning := map[int]bool{}
	order := []int{}
	for _, w := range wins {
		for _, id := range w.CellIDs {
			if !winning[id] {
				order = append(order, id)
				winning[id] = true
			}
		}
	}
	converted := map[int]bool{}
	transformed := []int{}
	for _, cell := range flatten(before) {
		if winning[cell.ID] && e.defs[cell.Symbol].id != e.defs[cell.Symbol].base {
			converted[cell.ID] = true
			transformed = append(transformed, cell.ID)
		}
	}
	removed := []int{}
	for _, id := range order {
		if !converted[id] {
			removed = append(removed, id)
		}
	}
	after := make(Board, len(before))
	refill := []int{}
	for c, col := range before {
		survivors := []Cell{}
		for _, cell := range col {
			if converted[cell.ID] {
				cell.Symbol = e.wild
				survivors = append(survivors, cell)
			} else if !winning[cell.ID] {
				survivors = append(survivors, cell)
			}
		}
		fresh := make([]Cell, len(col)-len(survivors))
		for i := range fresh {
			fresh[i] = Cell{ID: *nextID}
			*nextID++
			refill = append(refill, fresh[i].ID)
		}
		after[c] = append(fresh, survivors...)
	}
	return Step{Before: cloneBoard(before), After: after, Wins: wins, Removed: removed, Transformed: transformed, Refill: refill, RawPayout: decimal(addRaw(wins))}
}
func (e *Engine) decode(ctx context.Context, data []int, mode Mode, key string) (Round, error) {
	fail := func() (Round, error) { return Round{}, fmt.Errorf("invalid skeleton for multiplier %s", key) }
	if len(data) < 1 || len(data) > 30000 {
		return fail()
	}
	offset, nextID := 0, 1
	board := make(Board, len(e.game.Board.ColumnHeights))
	for c, h := range e.game.Board.ColumnHeights {
		board[c] = make([]Cell, h)
		for r := range board[c] {
			board[c][r].ID = nextID
			nextID++
		}
	}
	fixed, used := map[int]bool{}, map[int]bool{}
	apply := func(fresh []int) (int, error) {
		if offset >= len(data) {
			return 0, fmt.Errorf("missing skeleton stage")
		}
		count := data[offset]
		offset++
		if count < 0 || count > 144 || offset+count*2 > len(data) {
			return 0, fmt.Errorf("invalid skeleton count")
		}
		cells := []*Cell{}
		for c := range board {
			for r := range board[c] {
				cells = append(cells, &board[c][r])
			}
		}
		positions := map[int]bool{}
		for i := 0; i < count; i++ {
			p, id := data[offset], data[offset+1]
			offset += 2
			if p < 0 || p >= len(cells) || positions[p] || !contains(fresh, cells[p].ID) {
				return 0, fmt.Errorf("invalid fixed position")
			}
			d := e.defs[id]
			if d == nil || d.role != "normal" {
				return 0, fmt.Errorf("fixed symbol must be ordinary/gold")
			}
			positions[p] = true
			cells[p].Symbol = id
			fixed[cells[p].ID] = true
		}
		return count, nil
	}
	initialIDs := []int{}
	for _, cell := range flatten(board) {
		initialIDs = append(initialIDs, cell.ID)
	}
	n, err := apply(initialIDs)
	if err != nil {
		return fail()
	}
	if n == 0 && (len(data) != 1 || key != "0") {
		return fail()
	}
	result := Round{Initial: cloneBoard(board), Steps: []Step{}}
	total := new(big.Rat)
	for offset < len(data) {
		if err := ctx.Err(); err != nil {
			return Round{}, err
		}
		if len(result.Steps) >= 100 {
			return fail()
		}
		wins, err := e.evaluate(board, mode, len(result.Steps))
		if err != nil || len(wins) == 0 {
			return fail()
		}
		for _, w := range wins {
			for _, id := range w.CellIDs {
				used[id] = true
			}
		}
		step := e.advance(board, wins, &nextID)
		step.Index = len(result.Steps) + 1
		board = step.After
		count, err := apply(step.Refill)
		if err != nil {
			return fail()
		}
		step.After = cloneBoard(board)
		result.Steps = append(result.Steps, step)
		total.Add(total, mustRat(step.RawPayout))
		if offset == len(data) && count != 0 {
			return fail()
		}
	}
	wins, err := e.evaluate(board, mode, len(result.Steps))
	if err != nil || len(wins) > 0 || decimal(total) != key {
		return fail()
	}
	for id := range fixed {
		if !used[id] {
			return fail()
		}
	}
	result.Final = cloneBoard(board)
	result.RawMultiplier = decimal(total)
	return result, nil
}
func (e *Engine) validateRound(round Round, mode Mode) error {
	board := round.Initial
	nextID := 1
	for _, cell := range flatten(board) {
		if cell.ID >= nextID {
			nextID = cell.ID + 1
		}
	}
	sum := new(big.Rat)
	for i, step := range round.Steps {
		if !reflect.DeepEqual(board, step.Before) {
			return fmt.Errorf("round continuity mismatch")
		}
		if _, err := e.evaluate(step.After, mode, i+1); err != nil {
			return err
		}
		wins, err := e.evaluate(board, mode, i)
		if err != nil || len(wins) == 0 || winSignature(wins) != winSignature(step.Wins) {
			return fmt.Errorf("round winners mismatch")
		}
		expected := e.advance(board, wins, &nextID)
		if !reflect.DeepEqual(expected.Refill, step.Refill) || !reflect.DeepEqual(expected.Removed, step.Removed) || !reflect.DeepEqual(expected.Transformed, step.Transformed) || decimal(addRaw(wins)) != step.RawPayout {
			return fmt.Errorf("refill mismatch")
		}
		for c, col := range expected.After {
			for r, cell := range col {
				actual := step.After[c][r]
				if cell.ID != actual.ID || (cell.Symbol != 0 && cell.Symbol != actual.Symbol) {
					return fmt.Errorf("gravity/refill mismatch")
				}
			}
		}
		sum.Add(sum, addRaw(wins))
		board = step.After
	}
	if !reflect.DeepEqual(board, round.Final) {
		return fmt.Errorf("round final board mismatch")
	}
	wins, err := e.evaluate(board, mode, len(round.Steps))
	if err != nil || len(wins) > 0 || decimal(sum) != round.RawMultiplier {
		return fmt.Errorf("round final/payout mismatch")
	}
	return nil
}
func symbolNumber(s string) (int, error) {
	n, err := strconv.Atoi(s)
	if err != nil || n < 1 || n > 999 || strconv.Itoa(n) != s {
		return 0, fmt.Errorf("invalid base symbol ID %q", s)
	}
	return n, nil
}
