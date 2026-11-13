package ag4

import (
	"encoding/json"
	"fmt"
	"math/big"

	game "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/rules/paylines"
)

type Cell struct {
	ID       int `json:"id"`
	SymbolID int `json:"symbolId"`
}
type WireWin struct {
	SymbolID  int    `json:"symbolId"`
	Columns   int    `json:"columns"`
	Ways      int    `json:"ways"`
	CellIDs   []int  `json:"cellIds"`
	RawPayout string `json:"rawPayout"`
}
type ReplayInfo struct {
	PayoutUnit string `json:"payoutUnit"`
	LineCount  int    `json:"lineCount"`
}
type FeatureData struct {
	Target          *int           `json:"targetSymbolId"`
	Locked          []int          `json:"lockedCellIds"`
	Added           []int          `json:"addedCellIds"`
	BonusMultiplier int            `json:"bonusMultiplier"`
	LineWins        []paylines.Win `json:"lineWins"`
	Replay          ReplayInfo     `json:"replay"`
}
type Display struct {
	Mode           string      `json:"mode"`
	Board          [][]Cell    `json:"board"`
	Wins           []WireWin   `json:"wins"`
	RemovedIDs     []int       `json:"removedIds"`
	TransformedIDs []int       `json:"transformedIds"`
	SpinWinAmount  int64       `json:"spinWinAmount,omitempty"`
	GameData       FeatureData `json:"gameData"`
}

func (r *Runtime) result(stake int64, outcome outcome) (game.Result, error) {
	if stake <= 0 || outcome.NextSequence == 0 {
		return game.Result{}, fmt.Errorf("invalid AG4 stake/sequence")
	}
	raw, bonus, err := validateSequence(r.config.Rules, outcome.Mode, outcome.Sequence)
	if err != nil {
		return game.Result{}, err
	}
	if raw != outcome.Multiplier {
		return game.Result{}, fmt.Errorf("AG4 selected/actual multiplier mismatch")
	}
	if raw != "0" {
		keys := r.ordinaryAwards.keys
		if outcome.Mode == "respin" {
			keys = r.respinAwards.keys
		}
		found := false
		for _, key := range keys {
			found = found || key == raw
		}
		if !found {
			return game.Result{}, fmt.Errorf("AG4 multiplier absent from selected table")
		}
	}
	amount, err := payout(stake, raw)
	if err != nil {
		return game.Result{}, err
	}
	payload, err := json.Marshal(outcome)
	if err != nil {
		return game.Result{}, err
	}
	state, _ := json.Marshal(StateData{Sequence: outcome.NextSequence})
	result := game.Result{SchemaVersion: game.SchemaVersion, RuleType: r.Type(), GameID: ID, Version: r.Version(), BetMinorUnits: stake, ChargeMinorUnits: stake, WinMinorUnits: amount, NextState: game.State{RuleType: r.Type(), Version: r.Version(), SchemaVersion: StateSchema, Payload: state}, Payload: payload}
	for i, board := range outcome.Sequence.Boards {
		last := i == len(outcome.Sequence.Boards)-1
		display := Display{Mode: outcome.Mode, Wins: []WireWin{}, RemovedIDs: []int{}, TransformedIDs: []int{}, GameData: FeatureData{Target: outcome.Sequence.Target, Locked: []int{}, Added: outcome.Sequence.Added[i], BonusMultiplier: 1, LineWins: []paylines.Win{}, Replay: ReplayInfo{PayoutUnit: big.NewRat(stake, 5).RatString(), LineCount: 5}}}
		for c := 0; c < 3; c++ {
			column := []Cell{}
			for row := 0; row < 3; row++ {
				pos := c*3 + row
				column = append(column, Cell{ID: pos + 1, SymbolID: board[pos]})
				if outcome.Mode == "respin" && board[pos] != 0 {
					display.GameData.Locked = append(display.GameData.Locked, pos+1)
				}
			}
			display.Board = append(display.Board, column)
		}
		plan := game.Frame{NextAction: "continue"}
		if last {
			plan.WinMinorUnits = amount
			plan.NextAction = "complete"
			display.SpinWinAmount = amount
			evaluated, _, _, _ := Evaluate(r.config.Rules, board)
			display.GameData.LineWins = evaluated.Wins
			display.GameData.BonusMultiplier = bonus
			for _, win := range evaluated.Wins {
				raw, _ := paylines.Rat(win.Payout)
				raw.Mul(raw, big.NewRat(int64(bonus), 1))
				display.Wins = append(display.Wins, WireWin{SymbolID: win.SymbolID, Columns: 3, Ways: 1, CellIDs: win.CellIDs, RawPayout: raw.RatString()})
			}
		}
		plan.Payload, err = json.Marshal(display)
		if err != nil {
			return game.Result{}, err
		}
		result.Frames = append(result.Frames, plan)
	}
	return result, result.Validate()
}
