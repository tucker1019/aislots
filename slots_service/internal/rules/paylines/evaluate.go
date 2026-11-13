// Package paylines evaluates configured combinations. It has no bonus,
// respin, wallet, RNG or game-ID behavior.
package paylines

import (
	"encoding/json"
	"fmt"
	"math/big"
	"sort"
)

const RuleType = "paylines_v1"

type Symbol struct {
	ID     int         `json:"id"`
	Name   string      `json:"name"`
	Role   string      `json:"role"`
	Payout json.Number `json:"payout"`
	Weight json.Number `json:"weight"`
}
type Config struct {
	Version       int             `json:"version"`
	RuleType      string          `json:"ruleType"`
	ColumnHeights []int           `json:"columnHeights"`
	Lines         [][]int         `json:"lines"`
	Symbols       []Symbol        `json:"symbols"`
	Feature       json.RawMessage `json:"feature,omitempty"`
}
type Win struct {
	LineIndex int    `json:"lineIndex"`
	CellIDs   []int  `json:"cellIds"`
	SymbolID  int    `json:"symbolId"`
	Payout    string `json:"payout"`
}
type Result struct {
	Wins           []Win  `json:"wins"`
	RawPayout      string `json:"rawPayout"`
	WinningCellIDs []int  `json:"winningCellIds"`
}

func Rat(s string) (*big.Rat, error) {
	r, ok := new(big.Rat).SetString(s)
	if !ok || r.Sign() < 0 {
		return nil, fmt.Errorf("invalid nonnegative number %q", s)
	}
	return r, nil
}
func (c Config) Size() int {
	n := 0
	for _, h := range c.ColumnHeights {
		n += h
	}
	return n
}
func (c Config) Validate() error {
	if c.Version != 1 || c.RuleType != RuleType || len(c.ColumnHeights) < 1 || len(c.ColumnHeights) > 12 || len(c.Lines) < 1 || len(c.Lines) > 1000 || len(c.Symbols) < 1 || len(c.Symbols) > 100 {
		return fmt.Errorf("invalid payline config")
	}
	for _, h := range c.ColumnHeights {
		if h < 1 || h > 12 {
			return fmt.Errorf("invalid column height")
		}
	}
	seen := map[string]bool{}
	for _, line := range c.Lines {
		if len(line) < 2 {
			return fmt.Errorf("invalid payline")
		}
		cells := append([]int(nil), line...)
		sort.Ints(cells)
		for i, id := range cells {
			if id < 1 || id > c.Size() || (i > 0 && id == cells[i-1]) {
				return fmt.Errorf("invalid payline position")
			}
		}
		key := fmt.Sprint(cells)
		if seen[key] {
			return fmt.Errorf("duplicate payline")
		}
		seen[key] = true
	}
	ids := map[int]bool{}
	positive := false
	for _, s := range c.Symbols {
		if s.ID < 1 || s.ID > 1000000 || ids[s.ID] || s.Name == "" || (s.Role != "normal" && s.Role != "wild") {
			return fmt.Errorf("invalid payline symbol")
		}
		ids[s.ID] = true
		payout, err := Rat(string(s.Payout))
		if err != nil || payout.Cmp(big.NewRat(1000000000, 1)) > 0 {
			return fmt.Errorf("invalid payout")
		}
		weight, err := Rat(string(s.Weight))
		if err != nil || weight.Cmp(big.NewRat(1000000000, 1)) > 0 {
			return fmt.Errorf("invalid symbol weight")
		}
		positive = positive || weight.Sign() > 0
	}
	if !positive {
		return fmt.Errorf("no positive symbol weight")
	}
	return nil
}

func Evaluate(config Config, board []int) (Result, error) {
	if err := config.Validate(); err != nil {
		return Result{}, err
	}
	if len(board) != config.Size() {
		return Result{}, fmt.Errorf("board shape mismatch")
	}
	symbols := map[int]Symbol{}
	wild := map[int]bool{}
	for _, s := range config.Symbols {
		symbols[s.ID] = s
		wild[s.ID] = s.Role == "wild"
	}
	for _, id := range board {
		if id != 0 {
			if _, ok := symbols[id]; !ok {
				return Result{}, fmt.Errorf("unknown board symbol")
			}
		}
	}
	result := Result{Wins: []Win{}, WinningCellIDs: []int{}}
	total := new(big.Rat)
	winning := map[int]bool{}
	for index, line := range config.Lines {
		var best *Symbol
		highest := new(big.Rat)
		for i := range config.Symbols {
			s := &config.Symbols[i]
			payout, _ := Rat(string(s.Payout))
			if payout.Sign() == 0 {
				continue
			}
			match := true
			for _, pos := range line {
				if board[pos-1] != s.ID && !wild[board[pos-1]] {
					match = false
					break
				}
			}
			if match && (payout.Cmp(highest) > 0 || (payout.Cmp(highest) == 0 && (best == nil || s.ID < best.ID))) {
				best = s
				highest = payout
			}
		}
		if best != nil {
			result.Wins = append(result.Wins, Win{LineIndex: index, CellIDs: append([]int(nil), line...), SymbolID: best.ID, Payout: highest.RatString()})
			total.Add(total, highest)
			for _, id := range line {
				winning[id] = true
			}
		}
	}
	for id := range winning {
		result.WinningCellIDs = append(result.WinningCellIDs, id)
	}
	sort.Ints(result.WinningCellIDs)
	result.RawPayout = total.RatString()
	return result, nil
}
