package ag8

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
	RuleType        string     `json:"ruleType"`
	BuyMode         int        `json:"buyMode"`
	Special         bool       `json:"special"`
	StageIndex      int        `json:"stageIndex"`
	StageTotal      int        `json:"stageTotal"`
	FeatureSpins    int        `json:"featureSpins"`
	StagesRemaining int        `json:"stagesRemaining"`
	LockedCellIDs   []int      `json:"lockedCellIds"`
	Multipliers     []int64    `json:"multipliers"`
	MultiplierSum   int64      `json:"multiplierSum"`
	BlankMultiplier bool       `json:"blankMultiplier"`
	LineWins        []LineWin  `json:"lineWins"`
	RawPayout       int64      `json:"rawPayout"`
	RawWin          int64      `json:"rawWin"`
	PaidRawWin      int64      `json:"paidRawWin"`
	TotalPaidRaw    int64      `json:"totalPaidRaw"`
	CapRaw          int64      `json:"capRaw"`
	CapReached      bool       `json:"capReached"`
	Replay          ReplayInfo `json:"replay"`
}
type Display struct {
	Mode             string      `json:"mode"`
	BuyMode          int         `json:"buyMode"`
	Board            [][]Cell    `json:"board"`
	Wins             []WireWin   `json:"wins"`
	RemovedIDs       []int       `json:"removedIds"`
	TransformedIDs   []int       `json:"transformedIds"`
	SpinWinAmount    int64       `json:"spinWinAmount"`
	FreeRemaining    int         `json:"freeRemaining"`
	TriggeredFree    bool        `json:"triggeredFree"`
	AwardedFreeSpins int         `json:"awardedFreeSpins"`
	GameData         FeatureData `json:"gameData"`
}

func (w weighted) contains(n int64) bool {
	key := strconv.FormatInt(n, 10)
	for _, k := range w.keys {
		if key == k {
			return true
		}
	}
	return false
}
func (r *Runtime) validateStage(s stage, mode int, special bool) (Evaluation, error) {
	table, hit, name := r.profile(mode, special)
	e, err := evaluate(r.config.Rules, s.Board, name)
	if err != nil {
		return e, err
	}
	if e.RawPayout != s.Raw {
		return e, fmt.Errorf("AG8 selected multiplier mismatch")
	}
	for _, id := range s.Board {
		if id < 1 || id > 7 {
			return e, fmt.Errorf("AG8 board has hole")
		}
	}
	p, _ := new(big.Rat).SetString(string(hit))
	if s.Raw == 0 {
		if s.SkeletonIndex != nil || p.Cmp(big.NewRat(1, 1)) == 0 {
			return e, fmt.Errorf("invalid AG8 loss")
		}
		for _, id := range s.Board {
			if id == 7 {
				return e, fmt.Errorf("AG8 live loss has Wild")
			}
		}
	} else {
		lib := r.base
		if special {
			lib = r.free
		}
		key := strconv.FormatInt(s.Raw, 10)
		if p.Sign() == 0 || !table.contains(s.Raw) || s.SkeletonIndex == nil || *s.SkeletonIndex < 0 || *s.SkeletonIndex >= len(lib[key]) {
			return e, fmt.Errorf("AG8 unavailable positive award")
		}
		fixed, before, err := Inspect(r.config.Rules, lib[key][*s.SkeletonIndex], name)
		if err != nil {
			return e, err
		}
		if !reflect.DeepEqual(before, e) {
			return e, fmt.Errorf("AG8 fill changed lines")
		}
		for pos, id := range fixed {
			if (id > 0 && s.Board[pos] != id) || (id == 0 && s.Board[pos] == 7) {
				return e, fmt.Errorf("AG8 changed fixed cell or added Wild")
			}
		}
	}
	multipliers := r.normalMultipliers
	if special {
		if !r.freeCounts.contains(int64(len(s.Multipliers))) {
			return e, fmt.Errorf("AG8 invalid multiplier count")
		}
		multipliers = r.freeMultipliers
	} else if len(s.Multipliers) != 1 {
		return e, fmt.Errorf("AG8 ordinary spin requires one multiplier")
	}
	for _, n := range s.Multipliers {
		if !multipliers.contains(n) {
			return e, fmt.Errorf("AG8 impossible multiplier")
		}
	}
	return e, nil
}
func (r *Runtime) result(stake int64, choice outcome) (game.Result, error) {
	if stake <= 0 || choice.NextSequence == 0 || (choice.BuyMode != 1 && choice.BuyMode != 2) || len(choice.Stages) == 0 || len(choice.Stages) > 8 {
		return game.Result{}, fmt.Errorf("invalid AG8 flow")
	}
	divisor := int64(5)
	if choice.BuyMode == 2 {
		divisor = 25
	}
	capRaw := 2500 * divisor
	if _, err := payout(stake, capRaw, divisor); err != nil {
		return game.Result{}, err
	}
	p, _ := new(big.Rat).SetString(string(r.config.Parameters.Trigger))
	if (choice.Special && p.Sign() == 0) || (!choice.Special && p.Cmp(big.NewRat(1, 1)) == 0) || (!choice.Special && len(choice.Stages) != 1) {
		return game.Result{}, fmt.Errorf("impossible AG8 feature")
	}
	payload, err := json.Marshal(choice)
	if err != nil {
		return game.Result{}, err
	}
	state, _ := json.Marshal(StateData{choice.NextSequence})
	out := game.Result{SchemaVersion: game.SchemaVersion, RuleType: RuleType, GameID: ID, Version: r.Version(), BetMinorUnits: stake, ChargeMinorUnits: stake, NextState: game.State{RuleType: RuleType, Version: r.Version(), SchemaVersion: StateSchema, Payload: state}, Payload: payload}
	var total int64
	for i, s := range choice.Stages {
		if total >= capRaw {
			return game.Result{}, fmt.Errorf("AG8 contains stage after cap")
		}
		e, err := r.validateStage(s, choice.BuyMode, choice.Special)
		if err != nil {
			return game.Result{}, err
		}
		after := min(capRaw, total+s.Raw*sum(s.Multipliers))
		frame, err := r.makeFrame(stake, choice, i, e, total, after, divisor)
		if err != nil {
			return game.Result{}, err
		}
		out.Frames = append(out.Frames, frame)
		total = after
	}
	if choice.Special && len(choice.Stages) < 8 && total < capRaw {
		return game.Result{}, fmt.Errorf("AG8 free feature ended before eight spins without cap")
	}
	out.WinMinorUnits, err = payout(stake, total, divisor)
	if err != nil {
		return game.Result{}, err
	}
	return out, out.Validate()
}
func (r *Runtime) makeFrame(stake int64, choice outcome, i int, e Evaluation, before, after, divisor int64) (game.Frame, error) {
	s := choice.Stages[i]
	capRaw := 2500 * divisor
	prior, _ := payout(stake, before, divisor)
	paid, _ := payout(stake, after, divisor)
	last := i == len(choice.Stages)-1
	remaining := 0
	mode := "base"
	if choice.Special {
		mode = "free"
		remaining = 8 - i - 1
		if after == capRaw {
			remaining = 0
		}
	}
	data := FeatureData{RuleType: RuleType, BuyMode: choice.BuyMode, Special: choice.Special, StageIndex: i + 1, StageTotal: len(choice.Stages), FeatureSpins: 8, StagesRemaining: remaining, LockedCellIDs: []int{}, Multipliers: append([]int64{}, s.Multipliers...), MultiplierSum: sum(s.Multipliers), BlankMultiplier: !choice.Special && sum(s.Multipliers) == 1, LineWins: e.LineWins, RawPayout: s.Raw, RawWin: s.Raw * sum(s.Multipliers), PaidRawWin: after - before, TotalPaidRaw: after, CapRaw: capRaw, CapReached: after == capRaw, Replay: ReplayInfo{PayoutUnit: big.NewRat(stake, divisor).RatString(), LineCount: 5, Payouts: []PaidItem{}}}
	display := Display{Mode: mode, BuyMode: choice.BuyMode, Board: [][]Cell{}, Wins: []WireWin{}, RemovedIDs: []int{}, TransformedIDs: []int{}, SpinWinAmount: paid - prior, FreeRemaining: remaining, TriggeredFree: choice.Special && i == 0, GameData: data}
	if display.TriggeredFree {
		display.AwardedFreeSpins = 8
	}
	for col := 0; col < 3; col++ {
		column := []Cell{}
		for row := 0; row < 3; row++ {
			pos := col*3 + row
			column = append(column, Cell{pos + 1, s.Board[pos]})
		}
		display.Board = append(display.Board, column)
	}
	prefix := before
	for _, w := range e.LineWins {
		raw := w.Payout * sum(s.Multipliers)
		a, _ := payout(stake, min(capRaw, prefix), divisor)
		prefix += raw
		b, _ := payout(stake, min(capRaw, prefix), divisor)
		text := strconv.FormatInt(raw, 10)
		display.Wins = append(display.Wins, WireWin{w.SymbolID, 3, 1, w.CellIDs, text})
		display.GameData.Replay.Payouts = append(display.GameData.Replay.Payouts, PaidItem{w.SymbolID, 3, 1, text, strconv.FormatInt(b-a, 10)})
	}
	frame := game.Frame{WinMinorUnits: paid - prior, NextAction: "continue"}
	if last {
		frame.NextAction = "complete"
	}
	var err error
	frame.Payload, err = json.Marshal(display)
	return frame, err
}
