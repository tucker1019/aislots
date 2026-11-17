package ag10

import "fmt"

type LineWin struct {
	Line     int   `json:"line"`
	SymbolID int   `json:"symbolId"`
	Payout   int64 `json:"payout"`
	CellIDs  []int `json:"cellIds"`
}
type RewardCell struct {
	CellID   int   `json:"cellId"`
	SymbolID int   `json:"symbolId"`
	Payout   int64 `json:"payout"`
}
type Evaluation struct {
	RawPayout      int64        `json:"rawPayout"`
	LinePayout     int64        `json:"linePayout"`
	RewardPayout   int64        `json:"rewardPayout"`
	LineWins       []LineWin    `json:"lineWins"`
	Rewards        []RewardCell `json:"rewards"`
	WinningCellIDs []int        `json:"winningCellIds"`
}

func Evaluate(c Rules, board []int, mode string) (Evaluation, error) {
	if err := c.Validate(); err != nil {
		return Evaluation{}, err
	}
	return evaluate(c, board, mode)
}
func evaluate(c Rules, board []int, mode string) (Evaluation, error) {
	out := Evaluation{LineWins: []LineWin{}, Rewards: []RewardCell{}, WinningCellIDs: []int{}}
	if len(board) != 10 || (mode != "base" && mode != "free") {
		return out, fmt.Errorf("invalid AG10 board/mode")
	}
	wild, ordinary, rewards := map[int]bool{}, map[int]bool{}, map[int]Reward{}
	for _, s := range c.Symbols {
		ordinary[s.ID] = true
		wild[s.ID] = s.Role == "wild"
	}
	for _, s := range c.Rewards {
		rewards[s.ID] = s
	}
	for pos, id := range board {
		if s, ok := rewards[id]; ok {
			out.Rewards = append(out.Rewards, RewardCell{pos + 1, id, s.Payout})
		} else if id != 0 && (mode == "free" || !ordinary[id]) {
			return out, fmt.Errorf("unknown AG10 symbol or ordinary symbol in special spin")
		}
	}
	winning := map[int]bool{}
	if mode == "base" {
		for i, line := range c.Lines {
			var best *Symbol
			for j := range c.Symbols {
				s := &c.Symbols[j]
				matches := true
				for _, p := range line {
					if board[p-1] != s.ID && !wild[board[p-1]] {
						matches = false
						break
					}
				}
				// Stable configuration order breaks equal-payout ties, as in slot_math.
				if matches && (best == nil || s.Payout > best.Payout) {
					best = s
				}
			}
			if best != nil {
				out.LineWins = append(out.LineWins, LineWin{i + 1, best.ID, best.Payout, append([]int(nil), line...)})
				out.LinePayout += best.Payout
				for _, p := range line {
					winning[p] = true
				}
			}
		}
	}
	if len(out.Rewards) >= 5 {
		for _, s := range out.Rewards {
			out.RewardPayout += s.Payout
			winning[s.CellID] = true
		}
	}
	out.RawPayout = out.LinePayout + out.RewardPayout
	for p := 1; p <= 10; p++ {
		if winning[p] {
			out.WinningCellIDs = append(out.WinningCellIDs, p)
		}
	}
	return out, nil
}

type Skeleton struct {
	Cells []int `json:"cells"`
}

func Inspect(c Rules, s Skeleton, mode string) ([]int, Evaluation, error) {
	if err := c.Validate(); err != nil {
		return nil, Evaluation{}, err
	}
	board := make([]int, 10)
	if len(s.Cells) == 0 || len(s.Cells) > 20 || len(s.Cells)%2 != 0 {
		return nil, Evaluation{}, fmt.Errorf("invalid AG10 skeleton pairs")
	}
	for i := 0; i < len(s.Cells); i += 2 {
		p, id := s.Cells[i], s.Cells[i+1]
		if p < 0 || p >= 10 || id <= 0 || board[p] != 0 {
			return nil, Evaluation{}, fmt.Errorf("invalid/repeated AG10 skeleton position")
		}
		board[p] = id
	}
	e, err := evaluate(c, board, mode)
	if err != nil {
		return nil, e, err
	}
	if e.RawPayout <= 0 || len(e.WinningCellIDs)*2 != len(s.Cells) {
		return nil, e, fmt.Errorf("AG10 skeleton contains nonwinning fixed cells")
	}
	if mode == "base" {
		if err = validateFillable(c, board); err != nil {
			return nil, e, err
		}
	}
	return board, e, nil
}
