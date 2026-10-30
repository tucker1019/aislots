package engine

import (
	"context"
	"fmt"
	"math"
	"math/big"
)

// Spin resolves one rotation and returns a NEW state. It never mutates req.State or settles a wallet.
// Paid bets are positive minor-unit integers; during free spins the request bet must be zero.
func (e *Engine) Spin(ctx context.Context, req SpinRequest) (SpinResult, error) {
	fail := func(err error) (SpinResult, error) { return SpinResult{}, err }
	if err := ctx.Err(); err != nil {
		return fail(err)
	}
	state := req.State
	if state.Version != "" && state.Version != e.version {
		return fail(ErrVersion)
	}
	if state.Version == "" && (state.Sequence != 0 || state.Streak != 0 || state.FreeMisses != 0 || state.HasTriggeredFree || state.Free != nil) {
		return fail(ErrVersion)
	}
	if state.Sequence == math.MaxUint64 || state.Streak == math.MinInt64 || state.Streak == math.MaxInt64 || state.FreeMisses < 0 || state.FreeMisses == math.MaxInt {
		return fail(fmt.Errorf("invalid/overflow player state"))
	}
	state.Version = e.version
	mode := Base
	bet := req.BetMinorUnits
	charge := bet
	prob := e.baseProbability(state.Streak)
	triggerProb := e.triggerProbability(state.FreeMisses)
	forced := false
	if state.Free != nil {
		copy := *state.Free
		state.Free = &copy
		f := state.Free
		if req.BetMinorUnits != 0 || f.Remaining < 1 || f.Played < 0 || f.Wins < 0 || f.Wins > f.Played || f.Retriggers < 0 || f.Retriggers > 1000000 || f.Played >= math.MaxInt-1000001 || f.Remaining >= math.MaxInt-1000001 || f.GuaranteeAt > f.Played+f.Remaining || f.BetMinorUnits < 1 || !finite(f.WinProbability) || f.WinProbability < 0 || f.WinProbability > 1 || f.GuaranteeAt < 0 {
			return fail(fmt.Errorf("invalid free-session state or nonzero free-spin bet"))
		}
		mode = Free
		bet = f.BetMinorUnits
		charge = 0
		prob = f.WinProbability
		triggerProb = e.game.Parameters.FreeTrigger
	} else if bet <= 0 {
		return fail(fmt.Errorf("paid bet must be positive minor units"))
	}
	r := &random{source: e.options.Random}
	key := "0"
	if r.next() < prob {
		t := e.base
		weights := []float64{}
		if mode == Base {
			var err error
			weights, err = e.baseWeights(state.Streak)
			if err != nil {
				return fail(err)
			}
		} else {
			t = e.free
			for _, row := range t.rows {
				weights = append(weights, row.weight)
			}
		}
		key = t.rows[r.weighted(weights)].key
	}
	trigger := r.next() < triggerProb
	award := 0
	if mode == Free {
		f := state.Free
		if e.game.Parameters.RetriggerLimit != nil && f.Retriggers >= *e.game.Parameters.RetriggerLimit {
			trigger = false
		}
		f.Remaining--
		f.Played++
		if trigger {
			award = e.award(r)
			f.Remaining += award
			f.Retriggers++
		}
		forced = e.game.Parameters.Guaranteed && f.Played == f.GuaranteeAt && f.Wins == 0 && key == "0"
	}
	if forced {
		rows := []weightedRow{}
		weights := []float64{}
		for _, row := range e.free.rows {
			if row.key != "0" && row.weight > 0 {
				rows = append(rows, row)
				weights = append(weights, row.weight)
			}
		}
		key = rows[r.weighted(weights)].key
	}
	if mode == Base && trigger {
		award = e.award(r)
		freeProb, err := e.freeProbability(triggerProb)
		if err != nil {
			return fail(err)
		}
		guarantee := 0
		if e.game.Parameters.Guaranteed {
			guarantee = r.index(award) + 1
		}
		state.Free = &FreeSession{Remaining: award, BetMinorUnits: bet, WinProbability: freeProb, GuaranteeAt: guarantee}
	}
	if r.err != nil {
		return fail(r.err)
	}
	skeleton := []int{0}
	if key != "0" {
		count := e.store.Count(mode, key)
		if count == 0 {
			return fail(fmt.Errorf("%w: %s/%s", ErrMissingSkeleton, mode, key))
		}
		index := r.index(count)
		if r.err != nil {
			return fail(r.err)
		}
		var err error
		skeleton, err = e.store.Read(ctx, mode, key, index)
		if err != nil {
			return fail(err)
		}
	}
	reference, err := e.decode(ctx, skeleton, mode, key)
	if err != nil {
		return fail(err)
	}
	target := 0
	if trigger {
		target = e.options.TriggerSymbolCount
		if len(e.options.FreeAwardSymbolCounts) > 0 {
			target = e.options.FreeAwardSymbolCounts[award]
		}
	}
	round, err := e.fill(ctx, reference, mode, target, r)
	if err != nil {
		return fail(err)
	}
	// Sum exact raw winnings, divide by lines once, multiply total bet, then floor once per rotation.
	exact := new(big.Rat).Mul(mustRat(round.RawMultiplier), big.NewRat(bet, int64(e.game.Parameters.LineCount)))
	minor := new(big.Int).Quo(exact.Num(), exact.Denom())
	if !minor.IsInt64() {
		return fail(fmt.Errorf("payout overflows int64 minor units"))
	}
	if mode == Base {
		if key != "0" || trigger {
			if state.Streak > 0 {
				state.Streak++
			} else {
				state.Streak = 1
			}
		} else {
			if state.Streak < 0 {
				state.Streak--
			} else {
				state.Streak = -1
			}
		}
		if trigger {
			state.FreeMisses = 0
			state.HasTriggeredFree = true
		} else {
			cap := 1
			if rule := e.game.Parameters.TriggerRule; rule != nil && rule.Enabled {
				cap = rule.Cap
			}
			state.FreeMisses = min(state.FreeMisses+1, cap)
		}
	} else {
		if key != "0" {
			state.Free.Wins++
		}
		if state.Free.Remaining == 0 {
			state.Free = nil
		}
	}
	if err := ctx.Err(); err != nil {
		return fail(err)
	}
	if r.err != nil {
		return fail(r.err)
	}
	factors := e.game.Board.CascadeFactors
	if mode == Free {
		factors = e.game.Board.FreeCascadeFactors
	}
	for _, factor := range factors {
		round.CascadeFactors = append(round.CascadeFactors, factor.String())
	}
	e.addPreviews(&round, mode, r)
	if r.err != nil {
		return fail(r.err)
	}
	state.Sequence++
	return SpinResult{LineCount: e.game.Parameters.LineCount, GameID: e.game.ID, Version: e.version, Mode: mode, BetMinorUnits: bet, ChargeMinorUnits: charge, WinMinorUnits: minor.Int64(), ExactWinMinorUnits: decimal(exact), TriggeredFree: trigger, AwardedFreeSpins: award, Round: round, NextState: state}, nil
}
