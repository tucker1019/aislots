package engine

// Previews are presentation cells above the evaluated board. Build backwards so
// the lowest new refill cell is exactly the previous frame's visible preview.
func (e *Engine) addPreviews(round *Round, mode Mode, rng *random) {
	boards := make([]Board, 0, len(round.Steps)+1)
	maxID := 0
	for _, step := range round.Steps {
		boards = append(boards, step.Before)
	}
	boards = append(boards, round.Final)
	for _, board := range boards {
		for _, col := range board {
			for _, cell := range col {
				maxID = max(maxID, cell.ID)
			}
		}
	}
	previews := make([][]Cell, len(boards))
	last := len(boards) - 1
	previews[last] = make([]Cell, len(round.Final))
	choices := []int{}
	weights := []float64{}
	for _, symbol := range e.game.Board.Symbols {
		d := e.defs[mustSymbol(symbol.ID)]
		if d != nil && d.weight > 0 && (d.role == "normal" || d.role == "scatter") {
			choices = append(choices, d.id)
			weights = append(weights, d.weight)
		}
	}
	for c := range previews[last] {
		symbol := choices[rng.weighted(weights)]
		probability := e.game.Board.Gold.BaseProbability
		if mode == Free {
			probability = e.game.Board.Gold.FreeProbability
		}
		if e.defs[symbol].role == "normal" && contains(e.game.Board.Gold.Columns, c+1) && probability > 0 && rng.next() < probability {
			symbol += 1000
		}
		maxID++
		previews[last][c] = Cell{ID: maxID, Symbol: symbol}
	}
	for i := last - 1; i >= 0; i-- {
		previews[i] = make([]Cell, len(boards[i]))
		for c, col := range boards[i] {
			prior := map[int]bool{}
			for _, cell := range col {
				prior[cell.ID] = true
			}
			previews[i][c] = previews[i+1][c]
			for _, cell := range boards[i+1][c] {
				if !prior[cell.ID] {
					previews[i][c] = cell
				}
			}
		}
	}
	round.Previews = previews
}
