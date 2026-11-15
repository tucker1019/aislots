package ag5

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"math/big"
	"reflect"
	"strconv"
	"strings"

	game "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/rules/paylines"
)

type Options struct{ Random io.Reader }
type Runtime struct {
	config                                               Config
	base, free                                           Library
	baseAwards, freeAwards, normals, rewards, lossCounts weighted
	wild, rewardIDs                                      map[int]bool
	source                                               io.Reader
	version                                              string
}
type StateData struct {
	Sequence uint64 `json:"sequence"`
}
type SpinOutcome struct {
	Mode          string `json:"mode"`
	Board         []int  `json:"board"`
	Multiplier    int64  `json:"multiplier"`
	SkeletonIndex *int   `json:"skeletonIndex"`
}
type outcome struct {
	NextSequence uint64        `json:"nextSequence"`
	Triggered    bool          `json:"triggered"`
	Spins        []SpinOutcome `json:"spins"`
}

func Load(configDir, baseDir, freeDir string, options Options) (*Runtime, error) {
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
	return New(c, b, f, options)
}
func New(c Config, base, free Library, options Options) (*Runtime, error) {
	if err := c.Validate(); err != nil {
		return nil, err
	}
	raw, err := json.Marshal(c)
	if err != nil {
		return nil, err
	}
	var snapshot Config
	if err = json.Unmarshal(raw, &snapshot); err != nil {
		return nil, err
	}
	c = snapshot
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
	source := options.Random
	if source == nil {
		source = rand.Reader
	} else {
		source = &lockedReader{source: source}
	}
	r := &Runtime{config: c, base: base, free: free, source: source, wild: map[int]bool{}, rewardIDs: map[int]bool{}}
	table := func(rows []WeightRow) (weighted, error) {
		keys, weights := []string{}, []string{}
		for _, row := range rows {
			m, _ := paylines.Rat(string(row[0]))
			keys = append(keys, m.RatString())
			weights = append(weights, string(row[1]))
		}
		return newWeighted(keys, weights)
	}
	if r.baseAwards, err = table(c.Base); err != nil {
		return nil, err
	}
	if r.freeAwards, err = table(c.Free); err != nil {
		return nil, err
	}
	keys, weights := []string{}, []string{}
	for _, s := range c.Rules.Symbols {
		r.wild[s.ID] = s.Role == "wild"
		if s.Role == "normal" {
			keys = append(keys, strconv.Itoa(s.ID))
			weights = append(weights, string(s.Weight))
		}
	}
	if r.normals, err = newWeighted(keys, weights); err != nil {
		return nil, err
	}
	keys, weights = []string{}, []string{}
	for _, s := range c.Rules.Rewards {
		r.rewardIDs[s.ID] = true
		keys = append(keys, strconv.Itoa(s.ID))
		weights = append(weights, string(s.Weight))
	}
	if r.rewards, err = newWeighted(keys, weights); err != nil {
		return nil, err
	}
	// One Binomial(4,p) draw controls only loss decoration. Never draw ten
	// rewards and reject a paying board: losses have at most four by design.
	p, _ := paylines.Rat(string(c.Rules.Generation.RewardProbability))
	q := new(big.Rat).Sub(big.NewRat(1, 1), p)
	keys, weights = []string{}, []string{}
	for n, coefficient := range []int64{1, 4, 6, 4, 1} {
		weight := big.NewRat(coefficient, 1)
		for i := 0; i < n; i++ {
			weight.Mul(weight, p)
		}
		for i := n; i < 4; i++ {
			weight.Mul(weight, q)
		}
		keys = append(keys, strconv.Itoa(n))
		weights = append(weights, weight.RatString())
	}
	if r.lossCounts, err = newWeighted(keys, weights); err != nil {
		return nil, err
	}
	versionData, _ := json.Marshal(struct {
		Module, Generator  string
		Schema             int
		Config, Base, Free string
	}{ModuleVersion, "single-pass-v1", StateSchema, hash(raw), hash(br), hash(fr)})
	r.version = RuleType + ":" + hash(versionData)
	return r, nil
}
func (r *Runtime) Type() string    { return RuleType }
func (r *Runtime) Version() string { return r.version }
func DecodeState(state game.State) (StateData, error) {
	var data StateData
	if state.RuleType != RuleType || state.SchemaVersion != StateSchema || state.Pending || !strings.HasPrefix(state.Version, RuleType+":") || len(state.Version) != len(RuleType)+65 {
		return data, fmt.Errorf("invalid AG5 state envelope")
	}
	if err := strict(state.Payload, &data); err != nil {
		return data, err
	}
	return data, nil
}
func (r *Runtime) drawSpin(mode string, rng random) (SpinOutcome, error) {
	out := SpinOutcome{Mode: mode}
	probability, table, lib := r.config.Parameters.BaseWin, r.baseAwards, r.base
	if mode == "free" {
		probability, table, lib = r.config.Parameters.FreeWin, r.freeAwards, r.free
	}
	win, err := rng.chance(string(probability))
	if err != nil {
		return out, err
	}
	if !win {
		out.Board, err = r.loss(mode, rng)
		return out, err
	}
	key, err := table.pick(rng)
	if err != nil {
		return out, err
	}
	out.Multiplier, err = strconv.ParseInt(key, 10, 64)
	if err != nil {
		return out, err
	}
	list := lib[key]
	if len(list) == 0 {
		return out, fmt.Errorf("missing AG5 %s bucket %s", mode, key)
	}
	index, err := rng.index(len(list))
	if err != nil {
		return out, err
	}
	out.SkeletonIndex = &index
	out.Board, err = r.fill(list[index], mode, rng)
	return out, err
}
func (r *Runtime) Draw(ctx context.Context, request game.Request) (game.Result, error) {
	if err := ctx.Err(); err != nil {
		return game.Result{}, err
	}
	if request.BetMinorUnits <= 0 {
		return game.Result{}, fmt.Errorf("AG5 requires a positive paid stake")
	}
	if _, err := payout(request.BetMinorUnits, r.config.Parameters.MaxWin*10); err != nil {
		return game.Result{}, err
	}
	state := StateData{}
	initial := request.State.SchemaVersion == 0 && request.State.RuleType == "" && !request.State.Pending && (len(request.State.Payload) == 0 || string(request.State.Payload) == "null")
	if initial {
		if request.State.Version != "" && request.State.Version != r.Version() {
			return game.Result{}, fmt.Errorf("unknown initial AG5 version")
		}
	} else {
		var err error
		state, err = DecodeState(request.State)
		if err != nil {
			return game.Result{}, err
		}
	}
	if state.Sequence == math.MaxUint64 {
		return game.Result{}, fmt.Errorf("AG5 sequence overflow")
	}
	rng := random{r.source}
	first, err := r.drawSpin("base", rng)
	if err != nil {
		return game.Result{}, err
	}
	out := outcome{NextSequence: state.Sequence + 1, Spins: []SpinOutcome{first}}
	total, cap := first.Multiplier, r.config.Parameters.MaxWin*10
	if total < cap {
		out.Triggered, err = rng.chance(string(r.config.Parameters.Trigger))
		if err != nil {
			return game.Result{}, err
		}
		if out.Triggered {
			for i := 0; i < r.config.Parameters.FeatureSpins && total < cap; i++ {
				if err = ctx.Err(); err != nil {
					return game.Result{}, err
				}
				spin, err := r.drawSpin("free", rng)
				if err != nil {
					return game.Result{}, err
				}
				out.Spins = append(out.Spins, spin)
				total += spin.Multiplier
			}
		}
	}
	if err = ctx.Err(); err != nil {
		return game.Result{}, err
	}
	return r.result(request.BetMinorUnits, out)
}
func payout(stake, raw int64) (int64, error) {
	if stake <= 0 || raw < 0 {
		return 0, fmt.Errorf("invalid AG5 payout input")
	}
	n := new(big.Int).Mul(big.NewInt(stake), big.NewInt(raw))
	n.Quo(n, big.NewInt(10))
	if !n.IsInt64() {
		return 0, fmt.Errorf("AG5 payout overflow")
	}
	return n.Int64(), nil
}
func (r *Runtime) ValidateStoredResult(out game.Result) error {
	if err := out.Validate(); err != nil {
		return err
	}
	if out.GameID != ID || out.RuleType != r.Type() || out.Version != r.Version() || out.ChargeMinorUnits != out.BetMinorUnits {
		return fmt.Errorf("AG5 stored identity/charge mismatch")
	}
	var saved outcome
	if err := strict(out.Payload, &saved); err != nil {
		return err
	}
	expected, err := r.result(out.BetMinorUnits, saved)
	if err != nil {
		return err
	}
	var state, expectedState StateData
	state, err = DecodeState(out.NextState)
	if err != nil {
		return err
	}
	expectedState, _ = DecodeState(expected.NextState)
	if state != expectedState || out.WinMinorUnits != expected.WinMinorUnits || len(out.Frames) != len(expected.Frames) {
		return fmt.Errorf("AG5 stored amount/state mismatch")
	}
	for i, frame := range out.Frames {
		plan := expected.Frames[i]
		if frame.WinMinorUnits != plan.WinMinorUnits || frame.NextAction != plan.NextAction {
			return fmt.Errorf("AG5 stored credit plan mismatch")
		}
		var a, b Display
		if err = strict(frame.Payload, &a); err != nil {
			return err
		}
		if err = strict(plan.Payload, &b); err != nil {
			return err
		}
		if !reflect.DeepEqual(a, b) {
			return fmt.Errorf("AG5 stored presentation mismatch")
		}
	}
	return nil
}
func (r *Runtime) Present(out game.Result, c game.FrameContext) (json.RawMessage, error) {
	if c.FrameIndex < 0 || c.FrameIndex >= len(out.Frames) {
		return nil, fmt.Errorf("invalid AG5 frame")
	}
	return append(json.RawMessage(nil), out.Frames[c.FrameIndex].Payload...), nil
}
