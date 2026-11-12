package engine

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"math/big"
	"strconv"
)

type Engine struct {
	game          Game
	version       string
	store         SkeletonStore
	options       Options
	defs          map[int]*definition
	normal        []*definition
	wild          int
	base, free    table
	freeSpinsMean float64
}
type weightedRow struct {
	key           string
	weight, value float64
}
type table struct {
	rows                   []weightedRow
	weight, mean, positive float64
}

func finite(n float64) bool { return !math.IsNaN(n) && !math.IsInf(n, 0) }
func parseTable(rows []WeightRow) (table, error) {
	t := table{}
	for _, row := range rows {
		m, err := rational(row[0].String())
		if err != nil {
			return t, err
		}
		v, _ := m.Float64()
		w, err := strconv.ParseFloat(row[1].String(), 64)
		if err != nil || !finite(v) || !finite(w) || w < 0 {
			return t, fmt.Errorf("invalid weight row")
		}
		t.rows = append(t.rows, weightedRow{decimal(m), w, v})
		t.weight += w
		t.mean += v * w
		if m.Sign() > 0 {
			t.positive += w
		}
	}
	if len(rows) == 0 || t.weight <= 0 || !finite(t.weight) || !finite(t.mean) {
		return t, fmt.Errorf("invalid weight table")
	}
	t.mean /= t.weight
	t.positive /= t.weight
	return t, nil
}
func NewEngine(game Game, store SkeletonStore, options Options) (*Engine, error) {
	// Deep-copy configuration so callers cannot change a running engine.
	raw, err := json.Marshal(game)
	if err != nil {
		return nil, err
	}
	if err = json.Unmarshal(raw, &game); err != nil {
		return nil, err
	}
	e := &Engine{game: game, store: store, options: options, defs: map[int]*definition{}}
	// Legacy configurations retain their existing version; mapped games get a new version.
	versionRaw := raw
	if len(options.FreeAwardSymbolCounts) > 0 {
		mapping := make(map[int]int, len(options.FreeAwardSymbolCounts))
		for award, count := range options.FreeAwardSymbolCounts {
			if award < 1 || count < 3 || count > 5 {
				return nil, fmt.Errorf("invalid free award symbol mapping")
			}
			mapping[award] = count
		}
		for _, row := range game.Parameters.Awards {
			if row[1] > 0 && mapping[int(row[0])] == 0 {
				return nil, fmt.Errorf("missing scatter count for free award %v", row[0])
			}
		}
		e.options.FreeAwardSymbolCounts = mapping
		versionRaw, err = json.Marshal(struct {
			Game    json.RawMessage `json:"game"`
			Mapping map[int]int     `json:"freeAwardSymbolCounts"`
		}{raw, mapping})
		if err != nil {
			return nil, err
		}
	}
	sum := sha256.Sum256(versionRaw)
	e.version = RuleType + ":" + hex.EncodeToString(sum[:])
	if store == nil {
		return nil, fmt.Errorf("skeleton store required")
	}
	if options.MaxFillAttempts == 0 {
		e.options.MaxFillAttempts = 64
	}
	if e.options.MaxFillAttempts < 1 || e.options.MaxFillAttempts > 1000 {
		return nil, fmt.Errorf("invalid fill attempt limit")
	}
	if options.TriggerSymbolCount < 3 || options.TriggerSymbolCount > 5 {
		return nil, fmt.Errorf("explicit TriggerSymbolCount (3/4/5) required")
	}
	if err = e.validate(); err != nil {
		return nil, err
	}
	e.base, err = parseTable(game.BaseRows)
	if err != nil {
		return nil, err
	}
	e.free, err = parseTable(game.FreeRows)
	if err != nil {
		return nil, err
	}
	for _, entry := range []struct {
		mode Mode
		t    table
	}{{Base, e.base}, {Free, e.free}} {
		for _, row := range entry.t.rows {
			if row.weight > 0 && row.key != "0" && store.Count(entry.mode, row.key) == 0 {
				return nil, fmt.Errorf("%w: %s/%s", ErrMissingSkeleton, entry.mode, row.key)
			}
		}
	}
	e.freeSpinsMean, err = e.sessionSpins()
	if err != nil {
		return nil, err
	}
	if game.Parameters.Guaranteed && e.free.positive == 0 {
		return nil, fmt.Errorf("free guarantee requires positive payout rows")
	}
	for _, rule := range []*Rule{game.Parameters.LossRule, game.Parameters.WinRule} {
		if rule != nil && rule.Enabled {
			for n := rule.Start; n <= rule.Cap; n++ {
				streak := int64(n)
				if rule == game.Parameters.LossRule {
					streak = -streak
				}
				if _, err = e.baseWeights(streak); err != nil {
					return nil, err
				}
			}
		}
	}
	if r := game.Parameters.TriggerRule; r != nil && r.Enabled {
		for n := r.Start; n <= r.Cap; n++ {
			if _, err = e.freeProbability(e.triggerProbability(n)); err != nil {
				return nil, err
			}
		}
	}
	return e, nil
}
func (e *Engine) Version() string { return e.version }
func (e *Engine) validate() error {
	p, b := e.game.Parameters, e.game.Board
	if e.game.ID == "" || b.Version != 1 || p.LineCount < 1 {
		return fmt.Errorf("game ID/version/lineCount invalid")
	}
	for _, prob := range []float64{p.BaseWin, p.FreeWin, p.FreeTrigger, b.Gold.BaseProbability, b.Gold.FreeProbability} {
		if !finite(prob) || prob < 0 || prob > 1 {
			return fmt.Errorf("probability out of range")
		}
	}
	for _, n := range []*float64{b.FillWeightIncrement, b.ScatterWeightIncrement} {
		if n == nil || !finite(*n) || *n < 0 || *n > 1e9 {
			return fmt.Errorf("fill increments are required and must be 0..1e9")
		}
	}
	if len(b.ColumnHeights) < 3 || len(b.ColumnHeights) > 12 {
		return fmt.Errorf("invalid reel count")
	}
	for _, h := range b.ColumnHeights {
		if h < 1 || h > 12 {
			return fmt.Errorf("invalid reel height")
		}
	}
	seenFreeGold := map[int]bool{}
	for _, column := range b.FreeGoldColumns {
		if column < 1 || column > len(b.ColumnHeights) || seenFreeGold[column] {
			return fmt.Errorf("invalid free fixed gold reel")
		}
		seenFreeGold[column] = true
	}
	for _, ladder := range [][]json.Number{b.CascadeFactors, b.FreeCascadeFactors} {
		if len(ladder) < 1 || len(ladder) > 30 {
			return fmt.Errorf("invalid factor ladder")
		}
		for _, factor := range ladder {
			r, err := rational(factor.String())
			if err != nil || r.Sign() == 0 {
				return fmt.Errorf("invalid cascade factor")
			}
		}
	}
	weight := 0.0
	for _, s := range b.Symbols {
		id, err := symbolNumber(s.ID)
		if err != nil {
			return err
		}
		if e.defs[id] != nil || !finite(s.Weight) || s.Weight < 0 {
			return fmt.Errorf("duplicate symbol/invalid weight")
		}
		if s.Role != "normal" && s.Role != "wild" && s.Role != "scatter" {
			return fmt.Errorf("invalid symbol role")
		}
		if s.Role == "wild" && s.Weight != 0 {
			return fmt.Errorf("wild cannot be sampled")
		}
		d := &definition{id: id, base: id, role: s.Role, weight: s.Weight, payouts: map[int]*big.Rat{}}
		for columns, pay := range s.Payouts {
			if columns < 3 || columns > 12 {
				return fmt.Errorf("invalid payout columns")
			}
			r, err := rational(pay.String())
			if err != nil {
				return err
			}
			d.payouts[columns] = r
		}
		e.defs[id] = d
		if s.Role == "normal" {
			e.normal = append(e.normal, d)
			weight += s.Weight
		}
	}
	if weight <= 0 || !finite(weight) {
		return fmt.Errorf("ordinary symbol weight total must be positive")
	}
	if b.Gold.WildSymbolID != nil {
		n, err := symbolNumber(*b.Gold.WildSymbolID)
		if err != nil || e.defs[n] == nil || e.defs[n].role != "wild" {
			return fmt.Errorf("invalid gold conversion wild")
		}
		e.wild = n
	}
	if len(b.FreeGoldColumns) > 0 && e.wild == 0 {
		return fmt.Errorf("free gold requires conversion wild")
	}
	seen := map[int]bool{}
	for _, column := range b.Gold.Columns {
		if column < 1 || column > 12 || seen[column] || e.wild == 0 {
			return fmt.Errorf("invalid gold reels/wild")
		}
		seen[column] = true
	}
	if e.wild != 0 {
		for _, s := range e.normal {
			e.defs[s.id+1000] = &definition{id: s.id + 1000, base: s.id, role: "normal", weight: 0, payouts: s.payouts}
		}
	}
	for _, rule := range []*Rule{p.LossRule, p.WinRule, p.TriggerRule} {
		if rule == nil {
			continue
		}
		if rule.Start < 1 || rule.Interval < 1 || rule.Cap < rule.Start || rule.Cap > 10000 || !finite(rule.Step) || rule.Step < 0 || rule.Step > 1 || !finite(rule.Probability) || rule.Probability < 0 || rule.Probability > 1 {
			return fmt.Errorf("invalid probability strategy")
		}
	}
	if p.LossRule != nil && p.LossRule.Enabled && p.LossRule.Probability < p.BaseWin-1e-12 {
		return fmt.Errorf("loss strategy below base probability")
	}
	if p.WinRule != nil && p.WinRule.Enabled && p.WinRule.Probability > p.BaseWin+1e-12 {
		return fmt.Errorf("win strategy above base probability")
	}
	if p.RetriggerLimit != nil && (*p.RetriggerLimit < 0 || *p.RetriggerLimit > 100) {
		return fmt.Errorf("invalid retrigger limit")
	}
	awardWeight := 0.0
	if len(p.Awards) == 0 {
		return fmt.Errorf("free award weights required")
	}
	for _, row := range p.Awards {
		if !finite(row[0]) || row[0] < 1 || row[0] > 1e6 || row[0] != math.Trunc(row[0]) || !finite(row[1]) || row[1] < 0 {
			return fmt.Errorf("invalid free award row")
		}
		awardWeight += row[1]
	}
	if awardWeight <= 0 || !finite(awardWeight) {
		return fmt.Errorf("invalid free award total")
	}
	return nil
}

// RuleType versions the Ways matching, cascade, gold and skeleton verification algorithm.
const RuleType = "ways_cascade_v1"

func (e *Engine) Type() string { return RuleType }
