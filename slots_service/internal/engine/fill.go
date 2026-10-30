package engine

import (
	"context"
	"fmt"
	"math/big"
)

type placement struct {
	cell  *Cell
	scene int
}

func (e *Engine) fill(ctx context.Context, reference Round, mode Mode, target int, rng *random) (Round, error) {
	if target != 0 && (target < 3 || target > 5) {
		return Round{}, fmt.Errorf("invalid free symbol target")
	}
	maximum := target
	if maximum == 0 {
		maximum = 2
	}
	pool := []*definition{}
	for _, s := range e.game.Board.Symbols {
		d := e.defs[mustSymbol(s.ID)]
		if d.weight > 0 && (d.role == "normal" || d.role == "scatter") {
			pool = append(pool, d)
		}
	}
	capacity := 0
	for _, col := range reference.Initial {
		for _, cell := range col {
			if cell.Symbol == 0 {
				capacity++
				break
			}
		}
	}
	for _, step := range reference.Steps {
		for _, col := range step.After {
			for _, cell := range col {
				if cell.Symbol == 0 && contains(step.Refill, cell.ID) {
					capacity++
					break
				}
			}
		}
	}
	freeEnabled := false
	for _, s := range pool {
		if s.role == "scatter" {
			freeEnabled = true
		}
	}
	if target > 0 && (capacity < target || !freeEnabled) {
		return Round{}, fmt.Errorf("insufficient skeleton holes/free symbol weight for %d icons", target)
	}
	for attempt := 1; attempt <= e.options.MaxFillAttempts; attempt++ {
		if err := ctx.Err(); err != nil {
			return Round{}, err
		}
		boards := []Board{}
		expected := []string{}
		if len(reference.Steps) > 0 {
			for _, step := range reference.Steps {
				boards = append(boards, cloneBoard(step.Before))
				expected = append(expected, winSignature(step.Wins))
			}
		} else {
			boards = append(boards, cloneBoard(reference.Initial))
			expected = append(expected, "")
		}
		if len(reference.Steps) > 0 {
			boards = append(boards, cloneBoard(reference.Final))
			expected = append(expected, "")
		}
		places := map[int][]placement{}
		for i := range boards {
			for c := range boards[i] {
				for row := range boards[i][c] {
					cell := &boards[i][c][row]
					if cell.Symbol == 0 {
						places[cell.ID] = append(places[cell.ID], placement{cell, i})
					}
				}
			}
		}
		weights := map[int]float64{}
		for _, s := range pool {
			if s.role == "normal" {
				weights[s.id] = s.weight
			}
		}
		freeCount, remaining, dead := 0, capacity, false
		fillStage := func(board Board, wins []Win, stage int) error {
			before, err := e.evaluate(board, mode, stage)
			if err != nil {
				return err
			}
			if winSignature(before) != winSignature(wins) {
				dead = true
				return nil
			}
			forbidden := map[int]bool{}
			for _, w := range wins {
				forbidden[w.Symbol] = true
			}
			for c := range board {
				if err := ctx.Err(); err != nil {
					return err
				}
				freeAdded, hasHoles := false, false
				// Do not always place the scatter in the first empty row. The
				// previous top-to-bottom traversal made every trigger icon appear
				// in the first visible cell of its reel. Shuffle candidate rows per
				// reel while retaining the one-scatter-per-reel rule below.
				rows := make([]int, len(board[c]))
				for row := range rows {
					rows[row] = row
				}
				for i := len(rows) - 1; i > 0; i-- {
					j := rng.index(i + 1)
					if rng.err != nil {
						return rng.err
					}
					rows[i], rows[j] = rows[j], rows[i]
				}
				for _, row := range rows {
					cell := &board[c][row]
					if cell.Symbol != 0 {
						continue
					}
					hasHoles = true
					force := target > 0 && !freeAdded && target-freeCount >= remaining
					choices := []*definition{}
					choiceWeights := []float64{}
					for _, s := range pool {
						if s.role == "scatter" {
							if freeAdded || freeCount >= maximum {
								continue
							}
							weight := s.weight
							if stage != 0 || c != 0 {
								weight += *e.game.Board.ScatterWeightIncrement
							}
							choices = append(choices, s)
							choiceWeights = append(choiceWeights, weight)
							continue
						}
						if force || forbidden[s.id] {
							continue
						}
						entries := places[cell.ID]
						for _, p := range entries {
							p.cell.Symbol = s.id
						}
						safe := true
						for _, p := range entries {
							actual, err := e.evaluate(boards[p.scene], mode, p.scene)
							if err != nil {
								return err
							}
							if winSignature(actual) != expected[p.scene] {
								safe = false
								break
							}
						}
						for _, p := range entries {
							p.cell.Symbol = 0
						}
						if safe {
							choices = append(choices, s)
							choiceWeights = append(choiceWeights, weights[s.id])
						}
					}
					if len(choices) == 0 {
						dead = true
						return nil
					}
					s := choices[rng.weighted(choiceWeights)]
					if rng.err != nil {
						return rng.err
					}
					cell.Symbol = s.id
					probability := e.game.Board.Gold.BaseProbability
					if mode == Free {
						probability = e.game.Board.Gold.FreeProbability
					}
					if s.role == "normal" && contains(e.game.Board.Gold.Columns, c+1) && probability > 0 && rng.next() < probability {
						cell.Symbol += 1000
					}
					for _, p := range places[cell.ID] {
						p.cell.Symbol = cell.Symbol
					}
					if s.role == "scatter" {
						freeCount++
						freeAdded = true
					} else {
						weights[s.id] += *e.game.Board.FillWeightIncrement
					}
				}
				if hasHoles {
					remaining--
				}
			}
			actual, err := e.evaluate(board, mode, stage)
			if err != nil {
				return err
			}
			if winSignature(actual) != winSignature(wins) {
				return fmt.Errorf("filler changed winners")
			}
			return nil
		}
		current := cloneBoard(reference.Initial)
		var first []Win
		if len(reference.Steps) > 0 {
			first = reference.Steps[0].Wins
		}
		if err := fillStage(current, first, 0); err != nil {
			return Round{}, err
		}
		if dead {
			continue
		}
		result := Round{Initial: cloneBoard(current), Steps: []Step{}, RawMultiplier: reference.RawMultiplier}
		for i, source := range reference.Steps {
			actual, err := e.evaluate(current, mode, i)
			if err != nil {
				return Round{}, err
			}
			if winSignature(actual) != winSignature(source.Wins) {
				return Round{}, fmt.Errorf("filled chain mismatch")
			}
			carried := map[int]Cell{}
			for _, cell := range flatten(current) {
				carried[cell.ID] = cell
			}
			next := cloneBoard(source.After)
			for c := range next {
				for row := range next[c] {
					cell := &next[c][row]
					if !contains(source.Refill, cell.ID) && !contains(source.Transformed, cell.ID) {
						*cell = carried[cell.ID]
					}
				}
			}
			var nextWins []Win
			if i+1 < len(reference.Steps) {
				nextWins = reference.Steps[i+1].Wins
			}
			if err := fillStage(next, nextWins, i+1); err != nil {
				return Round{}, err
			}
			if dead {
				break
			}
			step := source
			step.Before = cloneBoard(current)
			step.After = cloneBoard(next)
			step.Wins = actual
			result.Steps = append(result.Steps, step)
			current = next
		}
		if dead || (target > 0 && freeCount != target) {
			continue
		}
		if rng.err != nil {
			return Round{}, rng.err
		}
		result.Final = cloneBoard(current)
		result.FreeSymbols = freeCount
		result.FillAttempts = attempt
		if err := e.validateRound(result, mode); err != nil {
			return Round{}, err
		}
		// Verify all newly born scatter limits, including the empty final refill.
		total := map[int]bool{}
		check := func(board Board, born []int) bool {
			for _, col := range board {
				added := 0
				for _, cell := range col {
					d := e.defs[cell.Symbol]
					if d == nil {
						return false
					}
					if d.role == "scatter" {
						total[cell.ID] = true
						if born == nil || contains(born, cell.ID) {
							added++
						}
					}
				}
				if added > 1 {
					return false
				}
			}
			return true
		}
		if !check(result.Initial, nil) {
			return Round{}, fmt.Errorf("initial free icon limit")
		}
		for _, step := range result.Steps {
			if !check(step.After, step.Refill) {
				return Round{}, fmt.Errorf("refill free icon limit")
			}
		}
		if len(total) != freeCount || freeCount > maximum {
			return Round{}, fmt.Errorf("total free icon limit")
		}
		sum := new(big.Rat)
		for _, step := range result.Steps {
			sum.Add(sum, mustRat(step.RawPayout))
		}
		if decimal(sum) != reference.RawMultiplier {
			return Round{}, fmt.Errorf("filled payout mismatch")
		}
		return result, nil
	}
	return Round{}, ErrFill
}
func mustSymbol(s string) int { n, _ := symbolNumber(s); return n }
