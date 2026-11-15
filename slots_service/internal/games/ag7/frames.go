package ag7

import (
	game "aislots/slots_service/internal/domain/game"
	"encoding/json"
	"fmt"
	"math/big"
	"reflect"
	"strconv"
)

type Cell struct {
	ID       int `json:"id"`
	SymbolID int `json:"symbolId"`
}
type WireWin struct {
	SymbolID  int    `json:"symbolId"`
	Columns   int    `json:"columns"`
	Ways      int64  `json:"ways"`
	CellIDs   []int  `json:"cellIds"`
	RawPayout string `json:"rawPayout"`
}
type PaidItem struct {
	SymbolID  int    `json:"symbolId"`
	Columns   int    `json:"columns"`
	Ways      int64  `json:"ways"`
	RawPayout string `json:"rawPayout"`
	Amount    string `json:"amount"`
}
type ReplayInfo struct {
	PayoutUnit string     `json:"payoutUnit"`
	LineCount  int        `json:"lineCount"`
	Payouts    []PaidItem `json:"payouts"`
}
type FeatureData struct {
	RuleType            string     `json:"ruleType"`
	Special             bool       `json:"special"`
	StageIndex          int        `json:"stageIndex"`
	StageTotal          int        `json:"stageTotal"`
	StagesRemaining     int        `json:"stagesRemaining"`
	LockedCellIDs       []int      `json:"lockedCellIds"`
	LineWins            []LineWin  `json:"lineWins"`
	RawPayout           int64      `json:"rawPayout"`
	Jackpot             bool       `json:"jackpot"`
	FullBoard           bool       `json:"fullBoard"`
	FullSymbolID        int        `json:"fullSymbolId"`
	FullBoardMultiplier int        `json:"fullBoardMultiplier"`
	SharedCellIDs       []int      `json:"sharedCellIds"`
	SharedSymbolID      int        `json:"sharedSymbolId"`
	Replay              ReplayInfo `json:"replay"`
}
type Display struct {
	Mode           string      `json:"mode"`
	Board          [][]Cell    `json:"board"`
	Wins           []WireWin   `json:"wins"`
	RemovedIDs     []int       `json:"removedIds"`
	TransformedIDs []int       `json:"transformedIds"`
	SpinWinAmount  int64       `json:"spinWinAmount"`
	GameData       FeatureData `json:"gameData"`
}

func (r *Runtime) validateFinal(out outcome) (Evaluation, error) {
	board := out.Boards[len(out.Boards)-1]
	e, err := evaluate(r.config.Rules, board, out.Mode)
	if err != nil {
		return e, err
	}
	if e.RawPayout != out.Multiplier {
		return e, fmt.Errorf("AG7 selected/actual multiplier mismatch")
	}
	if out.Multiplier == 0 {
		p, _ := new(big.Rat).SetString(string(r.config.Parameters.BaseWin))
		if out.Mode != "base" || out.SkeletonIndex != nil || p.Cmp(big.NewRat(1, 1)) == 0 {
			return e, fmt.Errorf("invalid AG7 ordinary loss")
		}
		return e, validateLoss(board, out.Mode)
	}
	table, lib := r.baseAwards, r.base
	if out.Mode == "free" {
		table, lib = r.freeAwards, r.free
	} else {
		p, _ := new(big.Rat).SetString(string(r.config.Parameters.BaseWin))
		if p.Sign() == 0 {
			return e, fmt.Errorf("AG7 ordinary win at zero hit probability")
		}
	}
	key := strconv.FormatInt(out.Multiplier, 10)
	found := false
	for _, k := range table.keys {
		found = found || k == key
	}
	if !found || out.SkeletonIndex == nil || *out.SkeletonIndex < 0 || *out.SkeletonIndex >= len(lib[key]) {
		return e, fmt.Errorf("AG7 selected multiplier/skeleton unavailable")
	}
	fixed, before, err := Inspect(r.config.Rules, lib[key][*out.SkeletonIndex], out.Mode)
	if err != nil {
		return e, err
	}
	if !reflect.DeepEqual(before, e) {
		return e, fmt.Errorf("AG7 fill changed winning lines")
	}
	for pos, id := range fixed {
		if (id > 0 && board[pos] != id) || (id == 0 && board[pos] == 7) {
			return e, fmt.Errorf("AG7 fill changed fixed cell or added Wild")
		}
	}
	return e, nil
}
func validateLoss(board []int, mode string) error {
	for _, id := range board {
		if id < 1 || id > 6 {
			return fmt.Errorf("AG7 live loss contains hole or Wild")
		}
	}
	if mode == "free" {
		return validateSides(board)
	}
	return nil
}
func (r *Runtime) result(stake int64, choice outcome) (game.Result, error) {
	if stake <= 0 || choice.NextSequence == 0 || (choice.Mode != "base" && choice.Mode != "free") || len(choice.Boards) < 1 || len(choice.Boards) > 9 {
		return game.Result{}, fmt.Errorf("invalid AG7 stake/flow")
	}
	if _, err := payout(stake, 20000); err != nil {
		return game.Result{}, err
	}
	trigger, _ := new(big.Rat).SetString(string(r.config.Parameters.Trigger))
	special := choice.Mode == "free"
	if (special && trigger.Sign() == 0) || (!special && trigger.Cmp(big.NewRat(1, 1)) == 0) {
		return game.Result{}, fmt.Errorf("AG7 impossible selected mode")
	}
	if special {
		losses := len(choice.Boards) - 1
		if choice.Multiplier <= 0 || losses < 2 || losses > 8 {
			return game.Result{}, fmt.Errorf("AG7 special sequence length mismatch")
		}
	} else if len(choice.Boards) != 1 {
		return game.Result{}, fmt.Errorf("AG7 ordinary mode must have one board")
	}
	for i, board := range choice.Boards {
		if len(board) != 10 {
			return game.Result{}, fmt.Errorf("invalid AG7 board length")
		}
		for _, id := range board {
			if id < 1 || id > 7 {
				return game.Result{}, fmt.Errorf("AG7 presented board contains holes")
			}
		}
		if i < len(choice.Boards)-1 {
			e, err := evaluate(r.config.Rules, board, choice.Mode)
			if err != nil || e.RawPayout != 0 {
				return game.Result{}, fmt.Errorf("AG7 earlier special board must lose")
			}
			if err = validateLoss(board, choice.Mode); err != nil {
				return game.Result{}, err
			}
		}
	}
	final, err := r.validateFinal(choice)
	if err != nil {
		return game.Result{}, err
	}
	amount, err := payout(stake, choice.Multiplier)
	if err != nil {
		return game.Result{}, err
	}
	payload, err := json.Marshal(choice)
	if err != nil {
		return game.Result{}, err
	}
	state, _ := json.Marshal(StateData{choice.NextSequence})
	out := game.Result{SchemaVersion: game.SchemaVersion, RuleType: r.Type(), GameID: ID, Version: r.Version(), BetMinorUnits: stake, ChargeMinorUnits: stake, WinMinorUnits: amount, NextState: game.State{RuleType: r.Type(), Version: r.Version(), SchemaVersion: StateSchema, Payload: state}, Payload: payload}
	for i := range choice.Boards {
		frame, err := r.makeFrame(stake, choice, i, final, amount)
		if err != nil {
			return game.Result{}, err
		}
		out.Frames = append(out.Frames, frame)
	}

	return out, out.Validate()
}

func (r *Runtime) makeFrame(stake int64, choice outcome, i int, final Evaluation, amount int64) (game.Frame, error) {
	board := choice.Boards[i]
	special := choice.Mode == "free"
	var err error
	last := i == len(choice.Boards)-1
	data := FeatureData{RuleType: RuleType, Special: special, StageIndex: i + 1, StageTotal: len(choice.Boards), StagesRemaining: len(choice.Boards) - i - 1, LockedCellIDs: []int{}, SharedCellIDs: []int{}, FullBoardMultiplier: 1, LineWins: []LineWin{}, Replay: ReplayInfo{PayoutUnit: big.NewRat(stake, 10).RatString(), LineCount: 10, Payouts: []PaidItem{}}}
	mode := "base"
	if special {
		mode = "respin"
		data.SharedCellIDs = []int{1, 2, 3, 8, 9, 10}
		data.SharedSymbolID = board[0]
	}
	display := Display{Mode: mode, Board: [][]Cell{}, Wins: []WireWin{}, RemovedIDs: []int{}, TransformedIDs: []int{}, GameData: data}
	pos := 0
	for _, height := range r.config.Rules.ColumnHeights {
		column := []Cell{}
		for row := 0; row < height; row++ {
			column = append(column, Cell{pos + 1, board[pos]})
			pos++
		}
		display.Board = append(display.Board, column)
	}

	plan := game.Frame{NextAction: "continue"}
	if last {
		plan.NextAction = "complete"
		plan.WinMinorUnits = amount
		display.SpinWinAmount = amount
		display.GameData.RawPayout = final.RawPayout
		display.GameData.Jackpot = final.Jackpot
		display.GameData.FullBoard, display.GameData.FullSymbolID, display.GameData.FullBoardMultiplier = final.FullBoard, final.FullSymbolID, final.FullBoardMultiplier
		display.GameData.LineWins = final.LineWins
		// Prefix floors allocate each minor unit exactly once, including fractional
		// per-line stakes. Jackpot is one replacement award, never ten additional line awards.
		var prefix int64
		add := func(id int, cells []int, raw int64) {
			before, _ := payout(stake, prefix)
			prefix += raw
			after, _ := payout(stake, prefix)
			text := strconv.FormatInt(raw, 10)
			display.Wins = append(display.Wins, WireWin{id, 3, 1, cells, text})
			display.GameData.Replay.Payouts = append(display.GameData.Replay.Payouts, PaidItem{id, 3, 1, text, strconv.FormatInt(after-before, 10)})
		}
		if final.Jackpot {
			add(7, final.WinningCellIDs, 20000)
		} else {
			for _, w := range final.LineWins {
				add(w.SymbolID, w.CellIDs, w.Payout)
			}
		}
	}
	plan.Payload, err = json.Marshal(display)
	if err != nil {
		return game.Frame{}, err
	}
	return plan, nil
}
