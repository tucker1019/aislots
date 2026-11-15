package ag8

import (
	game "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/rules/paylines"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"math/big"
	"reflect"
	"strconv"
	"strings"
)

type Options struct{ Random io.Reader }
type Runtime struct {
	config                                                  Config
	base, free                                              Library
	tables                                                  [2][2]weighted
	normals, normalMultipliers, freeCounts, freeMultipliers weighted
	source                                                  io.Reader
	version                                                 string
}
type StateData struct {
	Sequence uint64 `json:"sequence"`
}
type stage struct {
	Raw           int64   `json:"raw"`
	SkeletonIndex *int    `json:"skeletonIndex"`
	Board         []int   `json:"board"`
	Multipliers   []int64 `json:"multipliers"`
}
type outcome struct {
	NextSequence uint64  `json:"nextSequence"`
	BuyMode      int     `json:"buyMode"`
	Special      bool    `json:"special"`
	Stages       []stage `json:"stages"`
}

func Load(configDir, baseDir, freeDir string, o Options) (*Runtime, error) {
	c, err := LoadConfig(configDir)
	if err != nil {
		return nil, err
	}
	b, _, err := LoadLibrary(c, "base", baseDir)
	if err != nil {
		return nil, err
	}
	f, _, err := LoadLibrary(c, "free", freeDir)
	if err != nil {
		return nil, err
	}
	return New(c, b, f, o)
}
func weightedRows(rows []WeightRow) (weighted, error) {
	keys, weights := []string{}, []string{}
	for _, row := range rows {
		m, err := paylines.Rat(string(row[0]))
		if err != nil {
			return weighted{}, err
		}
		keys = append(keys, m.RatString())
		weights = append(weights, string(row[1]))
	}
	return newWeighted(keys, weights)
}
func New(c Config, base, free Library, o Options) (*Runtime, error) {
	if err := c.Validate(); err != nil {
		return nil, err
	}
	raw, err := json.Marshal(c)
	if err != nil {
		return nil, err
	}
	var copy Config
	if err = json.Unmarshal(raw, &copy); err != nil {
		return nil, err
	}
	c = copy
	br, _ := json.Marshal(base)
	fr, _ := json.Marshal(free)
	base, _, _, err = ValidateLibrary(c, "base", br)
	if err != nil {
		return nil, err
	}
	free, _, _, err = ValidateLibrary(c, "free", fr)
	if err != nil {
		return nil, err
	}
	source := o.Random
	if source == nil {
		source = rand.Reader
	} else {
		source = &lockedReader{source: source}
	}
	r := &Runtime{config: c, base: base, free: free, source: source}
	rows := [2][2][]WeightRow{{c.Base, c.Free}, {c.Dragon.Boost.Base, c.Dragon.Boost.Free}}
	for i := range rows {
		for j := range rows[i] {
			if r.tables[i][j], err = weightedRows(rows[i][j]); err != nil {
				return nil, err
			}
		}
	}
	keys, weights := []string{}, []string{}
	for _, s := range c.Rules.Symbols {
		if s.Role == "normal" {
			keys = append(keys, strconv.Itoa(s.ID))
			weights = append(weights, string(s.Weight))
		}
	}
	if r.normals, err = newWeighted(keys, weights); err != nil {
		return nil, err
	}
	for _, t := range []struct {
		out  *weighted
		rows []WeightRow
	}{{&r.normalMultipliers, c.Dragon.NormalMultipliers}, {&r.freeCounts, c.Dragon.FreeMultiplierCounts}, {&r.freeMultipliers, c.Dragon.FreeMultipliers}} {
		if *t.out, err = weightedRows(t.rows); err != nil {
			return nil, err
		}
	}
	version, _ := json.Marshal(struct{ Module, Config, Base, Free string }{ModuleVersion, hash(raw), hash(br), hash(fr)})
	r.version = RuleType + ":" + hash(version)
	return r, nil
}
func (r *Runtime) Type() string    { return RuleType }
func (r *Runtime) Version() string { return r.version }

// BetMultiplier is the platform's explicit capability for buy-mode stakes.
func (r *Runtime) BetMultiplier(mode int) (int64, error) {
	switch mode {
	case 0, 1:
		return 1, nil
	case 2:
		return 5, nil
	}
	return 0, fmt.Errorf("invalid AG8 buy mode")
}
func DecodeState(s game.State) (StateData, error) {
	var d StateData
	if s.RuleType != RuleType || s.SchemaVersion != StateSchema || s.Pending || !strings.HasPrefix(s.Version, RuleType+":") || len(s.Version) != len(RuleType)+65 {
		return d, fmt.Errorf("invalid AG8 state")
	}
	if _, e := hex.DecodeString(strings.TrimPrefix(s.Version, RuleType+":")); e != nil {
		return d, e
	}
	if e := strict(s.Payload, &d); e != nil {
		return d, e
	}
	return d, nil
}
func (r *Runtime) profile(mode int, special bool) (weighted, json.Number, string) {
	i, j := mode-1, 0
	hit := r.config.Parameters.BaseWin
	name := "base"
	if special {
		j = 1
		hit = r.config.Parameters.FreeWin
		name = "free"
	}
	if mode == 2 {
		hit = r.config.Dragon.Boost.BaseWin
		if special {
			hit = r.config.Dragon.Boost.FreeWin
		}
	}
	return r.tables[i][j], hit, name
}
func (r *Runtime) drawStage(mode int, special bool, rng random) (stage, error) {
	table, hit, name := r.profile(mode, special)
	s := stage{Multipliers: []int64{}}
	win, err := rng.chance(string(hit))
	if err != nil {
		return s, err
	}
	if win {
		key, e := table.pick(rng)
		if e != nil {
			return s, e
		}
		s.Raw, e = strconv.ParseInt(key, 10, 64)
		if e != nil {
			return s, e
		}
		lib := r.base
		if special {
			lib = r.free
		}
		list := lib[key]
		if len(list) == 0 {
			return s, fmt.Errorf("missing selected AG8 bucket %s", key)
		}
		idx, e := rng.index(len(list))
		if e != nil {
			return s, e
		}
		s.SkeletonIndex = &idx
		s.Board, err = r.fill(list[idx], name, rng)
	} else {
		s.Board, err = r.loss(name, rng)
	}
	if err != nil {
		return s, err
	}
	count := 1
	mul := r.normalMultipliers
	if special {
		key, e := r.freeCounts.pick(rng)
		if e != nil {
			return s, e
		}
		count, _ = strconv.Atoi(key)
		mul = r.freeMultipliers
	}
	for i := 0; i < count; i++ {
		key, e := mul.pick(rng)
		if e != nil {
			return s, e
		}
		n, _ := strconv.ParseInt(key, 10, 64)
		s.Multipliers = append(s.Multipliers, n)
	}
	return s, nil
}
func (r *Runtime) Draw(ctx context.Context, req game.Request) (game.Result, error) {
	if err := ctx.Err(); err != nil {
		return game.Result{}, err
	}
	mode := req.BuyMode
	if mode == 0 {
		mode = 1
	}
	if _, err := r.BetMultiplier(mode); err != nil {
		return game.Result{}, err
	}
	if _, err := payout(req.BetMinorUnits, 12500, 5); err != nil {
		return game.Result{}, err
	}
	var state StateData
	initial := req.State.SchemaVersion == 0 && req.State.RuleType == "" && !req.State.Pending && (len(req.State.Payload) == 0 || string(req.State.Payload) == "null")
	if initial {
		if req.State.Version != "" && req.State.Version != r.Version() {
			return game.Result{}, fmt.Errorf("unknown initial AG8 version")
		}
	} else {
		var err error
		state, err = DecodeState(req.State)
		if err != nil {
			return game.Result{}, err
		}
	}
	if state.Sequence == math.MaxUint64 {
		return game.Result{}, fmt.Errorf("AG8 sequence overflow")
	}
	rng := random{r.source}
	feature, err := rng.chance(string(r.config.Parameters.Trigger))
	if err != nil {
		return game.Result{}, err
	}
	out := outcome{NextSequence: state.Sequence + 1, BuyMode: mode, Special: feature, Stages: []stage{}}
	rounds, divisor := 1, int64(5)
	if mode == 2 {
		divisor = 25
	}
	if feature {
		rounds = 8
	}
	var total int64
	for i := 0; i < rounds; i++ {
		if err = ctx.Err(); err != nil {
			return game.Result{}, err
		}
		s, e := r.drawStage(mode, feature, rng)
		if e != nil {
			return game.Result{}, e
		}
		out.Stages = append(out.Stages, s)
		total += s.Raw * sum(s.Multipliers)
		if total >= 2500*divisor {
			break
		}
	}
	return r.result(req.BetMinorUnits, out)
}
func sum(a []int64) int64 {
	var n int64
	for _, v := range a {
		n += v
	}
	return n
}
func payout(stake, raw, divisor int64) (int64, error) {
	if stake <= 0 || raw < 0 || divisor <= 0 || raw > 2500*divisor {
		return 0, fmt.Errorf("invalid AG8 payout")
	}
	n := new(big.Int).Mul(big.NewInt(stake), big.NewInt(raw))
	n.Quo(n, big.NewInt(divisor))
	if !n.IsInt64() {
		return 0, fmt.Errorf("AG8 payout overflow")
	}
	return n.Int64(), nil
}
func (r *Runtime) ValidateStoredResult(out game.Result) error {
	if err := out.Validate(); err != nil {
		return err
	}
	if out.GameID != ID || out.RuleType != RuleType || out.Version != r.Version() || out.ChargeMinorUnits != out.BetMinorUnits {
		return fmt.Errorf("AG8 stored identity mismatch")
	}
	var saved outcome
	if err := strict(out.Payload, &saved); err != nil {
		return err
	}
	expected, err := r.result(out.BetMinorUnits, saved)
	if err != nil {
		return err
	}
	a, err := DecodeState(out.NextState)
	if err != nil {
		return err
	}
	b, _ := DecodeState(expected.NextState)
	if a != b || out.WinMinorUnits != expected.WinMinorUnits || len(out.Frames) != len(expected.Frames) {
		return fmt.Errorf("AG8 stored settlement mismatch")
	}
	for i, f := range out.Frames {
		plan := expected.Frames[i]
		if f.WinMinorUnits != plan.WinMinorUnits || f.NextAction != plan.NextAction {
			return fmt.Errorf("AG8 stored credit mismatch")
		}
		var a, b Display
		if err = strict(f.Payload, &a); err != nil {
			return err
		}
		if err = strict(plan.Payload, &b); err != nil {
			return err
		}
		if !reflect.DeepEqual(a, b) {
			return fmt.Errorf("AG8 stored display mismatch")
		}
	}
	return nil
}
func (r *Runtime) Present(out game.Result, c game.FrameContext) (json.RawMessage, error) {
	if c.FrameIndex < 0 || c.FrameIndex >= len(out.Frames) {
		return nil, fmt.Errorf("invalid AG8 frame")
	}
	return append(json.RawMessage(nil), out.Frames[c.FrameIndex].Payload...), nil
}
