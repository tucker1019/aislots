package ag10

import (
	"encoding/json"
	"fmt"
	"math/big"
	"strconv"

	game "aislots/slots_service/internal/domain/game"
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

// PaidItem keeps the original raw prize and its actual allocated credit.
// This matters when only part of the current spin fits under the round cap.
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
	RuleType         string       `json:"ruleType"`
	SpecialIndex     int          `json:"specialIndex"`
	SpecialTotal     int          `json:"specialTotal"`
	SpecialRemaining int          `json:"specialRemaining"`
	RewardCount      int          `json:"rewardCount"`
	Rewards          []RewardCell `json:"rewards"`
	LineWins         []LineWin    `json:"lineWins"`
	RawPayout        int64        `json:"rawPayout"`
	PaidRawPayout    int64        `json:"paidRawPayout"`
	DueAmount        int64        `json:"dueAmount"`
	PaidAmount       int64        `json:"paidAmount"`
	TruncatedAmount  int64        `json:"truncatedAmount"`
	Capped           bool         `json:"capped"`
	Replay           ReplayInfo   `json:"replay"`
}
type Display struct {
	Mode             string      `json:"mode"`
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

func (r *Runtime) validateSpin(spin SpinOutcome) (Evaluation, error) {
	e, err := evaluate(r.config.Rules, spin.Board, spin.Mode)
	if err != nil {
		return e, err
	}
	if e.RawPayout != spin.Multiplier {
		return e, fmt.Errorf("AG10 selected/actual multiplier mismatch")
	}
	lib, table, probability := r.base, r.baseAwards, r.config.Parameters.BaseWin
	if spin.Mode == "free" {
		lib, table, probability = r.free, r.freeAwards, r.config.Parameters.FreeWin
	}
	if spin.Mode == "base" {
		for _, id := range spin.Board {
			if id == 0 {
				return e, fmt.Errorf("AG10 ordinary board contains a hole")
			}
		}
	}
	if spin.Multiplier == 0 {
		p, _ := new(big.Rat).SetString(string(probability))
		if spin.SkeletonIndex != nil || p.Cmp(big.NewRat(1, 1)) == 0 || len(e.Rewards) > 4 {
			return e, fmt.Errorf("invalid AG10 live loss")
		}
		for _, id := range spin.Board {
			if r.wild[id] {
				return e, fmt.Errorf("AG10 live loss cannot add Wild")
			}
		}
		return e, nil
	}
	found := false
	key := strconv.FormatInt(spin.Multiplier, 10)
	for _, k := range table.keys {
		found = found || k == key
	}
	if !found || spin.SkeletonIndex == nil || *spin.SkeletonIndex < 0 || *spin.SkeletonIndex >= len(lib[key]) {
		return e, fmt.Errorf("AG10 missing selected bucket/skeleton")
	}
	p, _ := new(big.Rat).SetString(string(probability))
	if p.Sign() == 0 {
		return e, fmt.Errorf("AG10 winning outcome at zero hit probability")
	}
	fixed, _, err := Inspect(r.config.Rules, lib[key][*spin.SkeletonIndex], spin.Mode)
	if err != nil {
		return e, err
	}
	for pos, id := range fixed {
		if id != 0 {
			if spin.Board[pos] != id {
				return e, fmt.Errorf("AG10 fixed cell was changed")
			}
		} else if spin.Mode == "free" {
			if spin.Board[pos] != 0 {
				return e, fmt.Errorf("AG10 special skeleton holes must remain blank")
			}
		} else if r.wild[spin.Board[pos]] || r.rewardIDs[spin.Board[pos]] {
			return e, fmt.Errorf("AG10 fill added Wild/reward")
		}
	}
	return e, nil
}
func (r *Runtime) result(stake int64, outcome outcome) (game.Result, error) {
	cap := r.config.Parameters.MaxWin * 10
	if stake <= 0 || outcome.NextSequence == 0 || len(outcome.Spins) < 1 || len(outcome.Spins) > 9 {
		return game.Result{}, fmt.Errorf("invalid AG10 stake/flow")
	}
	if _, err := payout(stake, cap); err != nil {
		return game.Result{}, err
	}
	trigger, _ := new(big.Rat).SetString(string(r.config.Parameters.Trigger))
	if (outcome.Triggered && trigger.Sign() == 0) || (outcome.Triggered != (len(outcome.Spins) > 1)) {
		return game.Result{}, fmt.Errorf("invalid AG10 trigger flow")
	}
	payload, err := json.Marshal(outcome)
	if err != nil {
		return game.Result{}, err
	}
	state, _ := json.Marshal(StateData{outcome.NextSequence})
	out := game.Result{SchemaVersion: game.SchemaVersion, RuleType: r.Type(), GameID: ID, Version: r.Version(), BetMinorUnits: stake, ChargeMinorUnits: stake, NextState: game.State{RuleType: r.Type(), Version: r.Version(), SchemaVersion: StateSchema, Payload: state}, Payload: payload}
	var totalRaw int64
	for index, spin := range outcome.Spins {
		mode := "free"
		if index == 0 {
			mode = "base"
		}
		if spin.Mode != mode || totalRaw >= cap {
			return game.Result{}, fmt.Errorf("invalid AG10 spin order or spin after cap")
		}
		e, err := r.validateSpin(spin)
		if err != nil {
			return game.Result{}, err
		}
		paidRaw := min(cap-totalRaw, e.RawPayout)
		before, _ := payout(stake, totalRaw)
		after, _ := payout(stake, totalRaw+paidRaw)
		dueTotal, err := payout(stake, totalRaw+e.RawPayout)
		if err != nil {
			return game.Result{}, err
		}
		capped := totalRaw+paidRaw == cap
		last := index == len(outcome.Spins)-1
		if last && outcome.Triggered && !capped && index != r.config.Parameters.FeatureSpins {
			return game.Result{}, fmt.Errorf("AG10 special flow ended early")
		}
		if index == 0 && !outcome.Triggered && !capped && trigger.Cmp(big.NewRat(1, 1)) == 0 {
			return game.Result{}, fmt.Errorf("AG10 guaranteed trigger missing")
		}
		if index == 0 && capped && outcome.Triggered {
			return game.Result{}, fmt.Errorf("AG10 trigger after ordinary cap")
		}
		remaining, total := 0, 0
		if outcome.Triggered {
			total = r.config.Parameters.FeatureSpins
			remaining = total - index
		}
		if capped {
			remaining = 0
		}
		display := Display{Mode: mode, Wins: []WireWin{}, RemovedIDs: []int{}, TransformedIDs: []int{}, SpinWinAmount: after - before, FreeRemaining: remaining, TriggeredFree: index == 0 && outcome.Triggered, GameData: FeatureData{RuleType: RuleType, SpecialIndex: index, SpecialTotal: total, SpecialRemaining: remaining, RewardCount: len(e.Rewards), Rewards: e.Rewards, LineWins: e.LineWins, RawPayout: e.RawPayout, PaidRawPayout: paidRaw, DueAmount: dueTotal - before, PaidAmount: after - before, TruncatedAmount: dueTotal - after, Capped: capped, Replay: ReplayInfo{PayoutUnit: big.NewRat(stake, 10).RatString(), LineCount: 10, Payouts: []PaidItem{}}}}
		if display.TriggeredFree {
			display.AwardedFreeSpins = total
		}
		pos := 0
		for _, height := range r.config.Rules.ColumnHeights {
			column := []Cell{}
			for row := 0; row < height; row++ {
				column = append(column, Cell{pos + 1, spin.Board[pos]})
				pos++
			}
			display.Board = append(display.Board, column)
		}
		// Allocate line prizes, then reward faces in cell order. Raw prizes stay
		// unchanged; actual amounts use the remaining cap and cumulative floors.
		prefix := totalRaw
		add := func(symbol, columns int, cells []int, raw int64) {
			previous, _ := payout(stake, prefix)
			prefix = min(cap, prefix+raw)
			amount, _ := payout(stake, prefix)
			text := strconv.FormatInt(raw, 10)
			display.Wins = append(display.Wins, WireWin{symbol, columns, 1, cells, text})
			display.GameData.Replay.Payouts = append(display.GameData.Replay.Payouts, PaidItem{symbol, columns, 1, text, strconv.FormatInt(amount-previous, 10)})
		}
		for _, w := range e.LineWins {
			add(w.SymbolID, 3, w.CellIDs, w.Payout)
		}
		if e.RewardPayout > 0 {
			for _, w := range e.Rewards {
				add(w.SymbolID, 1, []int{w.CellID}, w.Payout)
			}
		}
		plan := game.Frame{WinMinorUnits: after - before, NextAction: "continue"}
		if last {
			plan.NextAction = "complete"
		}
		plan.Payload, err = json.Marshal(display)
		if err != nil {
			return game.Result{}, err
		}
		out.Frames = append(out.Frames, plan)
		totalRaw += paidRaw
	}
	out.WinMinorUnits, _ = payout(stake, totalRaw)
	return out, out.Validate()
}
