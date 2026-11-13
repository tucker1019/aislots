package ag4

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

type Options struct {
	Random io.Reader
	// Deprecated for AG4: generation is single-pass; kept for config compatibility.
	MaxFillAttempts int
}
type Runtime struct {
	config                                         Config
	base, respin                                   Library
	ordinaryAwards, respinAwards, symbols, targets weighted
	wild                                           map[int]bool
	source                                         io.Reader
	version                                        string
}
type StateData struct {
	Sequence uint64 `json:"sequence"`
}
type outcome struct {
	Mode         string   `json:"mode"`
	NextSequence uint64   `json:"nextSequence"`
	Sequence     Sequence `json:"sequence"`
	Multiplier   string   `json:"multiplier"`
}

func Load(configDir, baseDir, freeDir string, options Options) (*Runtime, error) {
	c, err := LoadConfig(configDir)
	if err != nil {
		return nil, err
	}
	base, _, err := LoadLibrary(c, "base", baseDir)
	if err != nil {
		return nil, err
	}
	respin, _, err := LoadLibrary(c, "free", freeDir)
	if err != nil {
		return nil, err
	}
	return New(c, base, respin, options)
}

func New(c Config, base, respin Library, options Options) (*Runtime, error) {
	if err := c.Validate(); err != nil {
		return nil, err
	}
	// Copy snapshots so editors/callers cannot mutate a running module.
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
	fr, _ := json.Marshal(respin)
	base, _, _, err = ValidateLibrary(c, "base", br)
	if err != nil {
		return nil, err
	}
	respin, _, _, err = ValidateLibrary(c, "free", fr)
	if err != nil {
		return nil, err
	}
	source := options.Random
	if source == nil {
		source = rand.Reader
	} else {
		source = &lockedReader{source: source}
	}
	r := &Runtime{config: c, base: base, respin: respin, source: source, wild: map[int]bool{}}
	table := func(rows []WeightRow) (weighted, error) {
		keys, weights := []string{}, []string{}
		for _, row := range rows {
			m, _ := paylines.Rat(string(row[0]))
			w, _ := paylines.Rat(string(row[1]))
			if m.Sign() > 0 && w.Sign() > 0 {
				keys = append(keys, m.RatString())
				weights = append(weights, string(row[1]))
			}
		}
		return newWeighted(keys, weights)
	}
	r.ordinaryAwards, err = table(c.Base)
	if err != nil {
		return nil, err
	}
	r.respinAwards, err = table(c.Respin)
	if err != nil {
		return nil, err
	}
	keys, weights := []string{}, []string{}
	for _, s := range c.Rules.Symbols {
		r.wild[s.ID] = s.Role == "wild"
		keys = append(keys, strconv.Itoa(s.ID))
		weights = append(weights, string(s.Weight))
	}
	r.symbols, err = newWeighted(keys, weights)
	if err != nil {
		return nil, err
	}
	keys, weights = []string{}, []string{}
	for _, target := range c.Feature.TargetWeights {
		keys = append(keys, strconv.Itoa(target.SymbolID))
		weights = append(weights, string(target.Weight))
	}
	r.targets, err = newWeighted(keys, weights)
	if err != nil {
		return nil, err
	}
	versionData, _ := json.Marshal(struct {
		Module, Generator        string
		Schema                   int
		ConfigHash, Base, Respin string
	}{ModuleVersion, "single-pass-v1", StateSchema, hash(raw), hash(br), hash(fr)})
	r.version = paylines.RuleType + ":" + hash(versionData)
	return r, nil
}
func (r *Runtime) Type() string    { return paylines.RuleType }
func (r *Runtime) Version() string { return r.version }

func DecodeState(state game.State) (StateData, error) {
	var out StateData
	if state.SchemaVersion != StateSchema || state.RuleType != paylines.RuleType || state.Pending || !strings.HasPrefix(state.Version, paylines.RuleType+":") {
		return out, fmt.Errorf("invalid AG4 state envelope")
	}
	if err := strict(state.Payload, &out); err != nil {
		return out, err
	}
	return out, nil
}

func (r *Runtime) Draw(ctx context.Context, request game.Request) (game.Result, error) {
	if err := ctx.Err(); err != nil {
		return game.Result{}, err
	}
	if request.BetMinorUnits <= 0 {
		return game.Result{}, fmt.Errorf("AG4 requires one positive paid stake")
	}
	if request.State.SchemaVersion == 0 && request.State.Version != "" && request.State.Version != r.Version() {
		return game.Result{}, fmt.Errorf("unknown initial AG4 version")
	}
	state := StateData{}
	if request.State.SchemaVersion != 0 || request.State.RuleType != "" || request.State.Pending || (len(request.State.Payload) > 0 && string(request.State.Payload) != "null") {
		var err error
		state, err = DecodeState(request.State)
		if err != nil {
			return game.Result{}, err
		}
	}
	if state.Sequence == math.MaxUint64 {
		return game.Result{}, fmt.Errorf("AG4 sequence overflow")
	}
	rng := random{r.source}
	feature, err := rng.chance(string(r.config.Parameters.Trigger))
	if err != nil {
		return game.Result{}, err
	}
	mode, libraryMode, probability := "base", "base", r.config.Parameters.BaseWin
	table, lib := r.ordinaryAwards, r.base
	if feature {
		mode, libraryMode, probability = "respin", "free", r.config.Parameters.RespinWin
		table, lib = r.respinAwards, r.respin
	}
	win, err := rng.chance(string(probability))
	if err != nil {
		return game.Result{}, err
	}
	var seq Sequence
	multiplier := "0"
	if win {
		key, err := table.pick(rng)
		if err != nil {
			return game.Result{}, err
		}
		multiplier = key
		list := lib[key]
		if len(list) == 0 {
			return game.Result{}, fmt.Errorf("missing AG4 bucket %s", key)
		}
		index, err := rng.index(len(list))
		if err != nil {
			return game.Result{}, err
		}
		if feature {
			seq, _, err = Inspect(r.config.Rules, list[index], libraryMode)
		} else {
			seq, err = r.normal(list[index], key, rng)
		}
		if err != nil {
			return game.Result{}, err
		}
	} else {
		seq, err = r.zero(libraryMode, rng)
		if err != nil {
			return game.Result{}, err
		}
	}
	if err = ctx.Err(); err != nil {
		return game.Result{}, err
	}
	return r.result(request.BetMinorUnits, outcome{Mode: mode, NextSequence: state.Sequence + 1, Sequence: seq, Multiplier: multiplier})
}

func payout(stake int64, raw string) (int64, error) {
	multiplier, err := paylines.Rat(raw)
	if err != nil {
		return 0, err
	}
	exact := new(big.Rat).Mul(multiplier, big.NewRat(stake, 5))
	minor := new(big.Int).Quo(exact.Num(), exact.Denom())
	if !minor.IsInt64() {
		return 0, fmt.Errorf("AG4 payout overflow")
	}
	return minor.Int64(), nil
}

func (r *Runtime) ValidateStoredResult(out game.Result) error {
	if err := out.Validate(); err != nil {
		return err
	}
	if out.GameID != ID || out.RuleType != r.Type() || out.Version != r.Version() || out.ChargeMinorUnits != out.BetMinorUnits {
		return fmt.Errorf("AG4 stored identity/charge mismatch")
	}
	var saved outcome
	if err := strict(out.Payload, &saved); err != nil {
		return err
	}
	expected, err := r.result(out.BetMinorUnits, saved)
	if err != nil {
		return err
	}
	state, err := DecodeState(out.NextState)
	if err != nil {
		return err
	}
	if state.Sequence != saved.NextSequence || out.WinMinorUnits != expected.WinMinorUnits || len(out.Frames) != len(expected.Frames) {
		return fmt.Errorf("AG4 stored amount/state mismatch")
	}
	for i, frame := range out.Frames {
		plan := expected.Frames[i]
		if frame.WinMinorUnits != plan.WinMinorUnits || frame.NextAction != plan.NextAction {
			return fmt.Errorf("AG4 stored credit plan mismatch")
		}
		var a, b Display
		if err = strict(frame.Payload, &a); err != nil {
			return err
		}
		if err = strict(plan.Payload, &b); err != nil {
			return err
		}
		if !reflect.DeepEqual(a, b) {
			return fmt.Errorf("AG4 stored presentation mismatch")
		}
	}
	return nil
}

func (r *Runtime) Present(out game.Result, c game.FrameContext) (json.RawMessage, error) {
	if c.FrameIndex < 0 || c.FrameIndex >= len(out.Frames) {
		return nil, fmt.Errorf("invalid AG4 frame")
	}
	return append(json.RawMessage(nil), out.Frames[c.FrameIndex].Payload...), nil
}
