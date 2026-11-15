package ag7

import "fmt"

type LineWin struct {
	Line     int   `json:"line"`
	SymbolID int   `json:"symbolId"`
	Payout   int64 `json:"payout"`
	CellIDs  []int `json:"cellIds"`
}
type Evaluation struct {
	RawPayout           int64     `json:"rawPayout"`
	Jackpot             bool      `json:"jackpot"`
	FullBoard           bool      `json:"fullBoard"`
	FullSymbolID        int       `json:"fullSymbolId"`
	FullBoardMultiplier int       `json:"fullBoardMultiplier"`
	LineWins            []LineWin `json:"lineWins"`
	WinningCellIDs      []int     `json:"winningCellIds"`
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
	out := Evaluation{LineWins: []LineWin{}, WinningCellIDs: []int{}, FullBoardMultiplier: 1}
	if len(board) != 10 || (mode != "base" && mode != "free") {
		return out, fmt.Errorf("invalid AG7 board/mode")
	}
	if mode == "free" {
		if err := validateSides(board); err != nil {
			return out, err
		}
	}
	out.Jackpot = true
	for _, id := range board {
		if id < 0 || id > 7 {
			return out, fmt.Errorf("invalid AG7 symbol")
		}
		out.Jackpot = out.Jackpot && id == 7
	}
	if out.Jackpot {
		out.RawPayout = 20000
		out.FullBoard, out.FullSymbolID, out.FullBoardMultiplier = true, 7, 10
		out.WinningCellIDs = []int{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
		return out, nil
	}
	out.FullSymbolID = fullSymbol(board)
	out.FullBoard = out.FullSymbolID > 0
	if out.FullBoard {
		out.FullBoardMultiplier = 10
	}
	winning := [10]bool{}
	for i, line := range c.Lines {
		id := 7
		for _, p := range line {
			if board[p-1] != 7 {
				id = board[p-1]
				break
			}
		}
		if out.FullBoard {
			id = out.FullSymbolID
		}
		if id == 0 {
			continue
		}
		match := true
		for _, p := range line {
			match = match && (board[p-1] == id || board[p-1] == 7)
		}
		if match {
			payout := c.Symbols[id-1].Payout * int64(out.FullBoardMultiplier)
			out.RawPayout += payout
			out.LineWins = append(out.LineWins, LineWin{i + 1, id, payout, append([]int{}, line...)})
			for _, p := range line {
				winning[p-1] = true
			}
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
	board := make([]int, 10)
	if len(s.Cells) == 0 || len(s.Cells) > 20 || len(s.Cells)%2 != 0 {
		return nil, Evaluation{}, fmt.Errorf("invalid AG7 skeleton pairs")
	}
	for i := 0; i < len(s.Cells); i += 2 {
		p, id := s.Cells[i], s.Cells[i+1]
		if p < 0 || p >= 10 || id < 1 || id > 7 || board[p] != 0 {
			return nil, Evaluation{}, fmt.Errorf("invalid AG7 skeleton position/symbol")
		}
		board[p] = id
	}
	e, err := evaluate(c, board, mode)
	if err != nil {
		return nil, e, err
	}
	necessary := [10]bool{}
	for _, p := range e.WinningCellIDs {
		necessary[p-1] = true
	}
	if mode == "free" {
		for _, p := range sidePositions {
			necessary[p] = true
		}
	}
	count := 0
	for _, v := range necessary {
		if v {
			count++
		}
	}
	if e.RawPayout <= 0 || count*2 != len(s.Cells) {
		return nil, e, fmt.Errorf("AG7 skeleton contains nonessential fixed cells")
	}
	for p, id := range board {
		if id > 0 && !necessary[p] {
			return nil, e, fmt.Errorf("AG7 nonwinning fixed cell")
		}
	}
	if err = validateFillable(c, board); err != nil {
		return nil, e, err
	}
	return board, e, nil
}

func fullSymbol(board []int) int {
	symbol := 7
	for _, id := range board {
		if id == 0 {
			return 0
		}
		if id == 7 {
			continue
		}
		if symbol != 7 && symbol != id {
			return 0
		}
		symbol = id
	}
	return symbol
}
func validateSides(board []int) error {
	if len(board) != 10 || board[0] < 1 || board[0] > 6 {
		return fmt.Errorf("AG7 special sides require an ordinary symbol")
	}
	for _, p := range sidePositions {
		if board[p] != board[0] {
			return fmt.Errorf("AG7 special six side symbols differ")
		}
	}
	return nil
}
