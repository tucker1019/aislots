package ag8

import "fmt"

type LineWin struct {
	Line     int   `json:"line"`
	SymbolID int   `json:"symbolId"`
	Payout   int64 `json:"payout"`
	CellIDs  []int `json:"cellIds"`
}
type Evaluation struct {
	RawPayout      int64     `json:"rawPayout"`
	LineWins       []LineWin `json:"lineWins"`
	WinningCellIDs []int     `json:"winningCellIds"`
}
type Skeleton struct {
	Cells []int `json:"cells"`
}

func Evaluate(c Rules, board []int, mode string) (Evaluation, error) {
	if err := c.Validate(); err != nil {
		return Evaluation{}, err
	}
	return evaluate(c, board, mode)
}
func evaluate(c Rules, board []int, mode string) (Evaluation, error) {
	out := Evaluation{LineWins: []LineWin{}, WinningCellIDs: []int{}}
	if len(board) != 9 || (mode != "base" && mode != "free") {
		return out, fmt.Errorf("invalid AG8 board/mode")
	}
	for _, id := range board {
		if id < 0 || id > 7 {
			return out, fmt.Errorf("invalid AG8 symbol")
		}
	}
	winning := [9]bool{}
	for i, line := range c.Lines {
		id := 7
		for _, p := range line {
			if board[p-1] != 7 {
				id = board[p-1]
				break
			}
		}
		if id == 0 {
			continue
		}
		match := true
		for _, p := range line {
			match = match && (board[p-1] == id || board[p-1] == 7)
		}
		if !match {
			continue
		}
		payout := c.Symbols[id-1].Payout
		out.RawPayout += payout
		out.LineWins = append(out.LineWins, LineWin{i + 1, id, payout, append([]int{}, line...)})
		for _, p := range line {
			winning[p-1] = true
		}
	}
	for p, win := range winning {
		if win {
			out.WinningCellIDs = append(out.WinningCellIDs, p+1)
		}
	}
	return out, nil
}
func Inspect(c Rules, s Skeleton, mode string) ([]int, Evaluation, error) {
	if err := c.Validate(); err != nil {
		return nil, Evaluation{}, err
	}
	board := make([]int, 9)
	if len(s.Cells) == 0 || len(s.Cells) > 18 || len(s.Cells)%2 != 0 {
		return nil, Evaluation{}, fmt.Errorf("invalid AG8 skeleton pairs")
	}
	for i := 0; i < len(s.Cells); i += 2 {
		p, id := s.Cells[i], s.Cells[i+1]
		if p < 0 || p >= 9 || id < 1 || id > 7 || board[p] != 0 {
			return nil, Evaluation{}, fmt.Errorf("invalid AG8 skeleton position/symbol")
		}
		board[p] = id
	}
	e, err := evaluate(c, board, mode)
	if err != nil {
		return nil, e, err
	}
	necessary := [9]bool{}
	for _, p := range e.WinningCellIDs {
		necessary[p-1] = true
	}
	if e.RawPayout <= 0 || len(e.WinningCellIDs)*2 != len(s.Cells) {
		return nil, e, fmt.Errorf("AG8 skeleton contains nonessential cells")
	}
	for p, id := range board {
		if id > 0 && !necessary[p] {
			return nil, e, fmt.Errorf("AG8 fixed nonwinning cell")
		}
	}
	if err = validateFillable(c, board); err != nil {
		return nil, e, err
	}
	return board, e, nil
}
