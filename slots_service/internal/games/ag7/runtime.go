package ag7

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
	config                                   Config
	base, free                               Library
	baseAwards, freeAwards, normals, lengths weighted
	source                                   io.Reader
	version                                  string
}
type StateData struct {
	Sequence uint64 `json:"sequence"`
}
type outcome struct {
	NextSequence  uint64  `json:"nextSequence"`
	Mode          string  `json:"mode"`
	Multiplier    int64   `json:"multiplier"`
	SkeletonIndex *int    `json:"skeletonIndex"`
	Boards        [][]int `json:"boards"`
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
	br, err := json.Marshal(base)
	if err != nil {
		return nil, err
	}
	fr, err := json.Marshal(free)
	if err != nil {
		return nil, err
	}
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
	r := &Runtime{config: c, base: base, free: free, source: source}
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
		if s.Role == "normal" {
			keys = append(keys, strconv.Itoa(s.ID))
			weights = append(weights, string(s.Weight))
		}
	}
	if r.normals, err = newWeighted(keys, weights); err != nil {
		return nil, err
	}
	if r.lengths, err = newWeighted([]string{"2", "3", "4", "5", "6", "7", "8"}, []string{"100", "500", "1000", "2500", "3200", "2300", "400"}); err != nil {
		return nil, err
	}
	versionData, _ := json.Marshal(struct {
		Module, Generator  string
		Schema             int
		Config, Base, Free string
	}{ModuleVersion, "single-pass-length-1023-v1", StateSchema, hash(raw), hash(br), hash(fr)})
	r.version = RuleType + ":" + hash(versionData)
	return r, nil
}
func (r *Runtime) Type() string    { return RuleType }
func (r *Runtime) Version() string { return r.version }
func DecodeState(state game.State) (StateData, error) {
	var data StateData
	if state.RuleType != RuleType || state.SchemaVersion != StateSchema || state.Pending || !strings.HasPrefix(state.Version, RuleType+":") || len(state.Version) != len(RuleType)+65 {
		return data, fmt.Errorf("invalid AG7 state envelope")
	}
	if _, err := hex.DecodeString(strings.TrimPrefix(state.Version, RuleType+":")); err != nil {
		return data, err
	}
	if err := strict(state.Payload, &data); err != nil {
		return data, err
	}
	return data, nil
}
func (r *Runtime) winning(mode string, rng random) (int64, *int, []int, error) {
	table, lib := r.baseAwards, r.base
	if mode == "free" {
		table, lib = r.freeAwards, r.free
	}
	key, err := table.pick(rng)
	if err != nil {
		return 0, nil, nil, err
	}
	raw, err := strconv.ParseInt(key, 10, 64)
	if err != nil {
		return 0, nil, nil, err
	}
	list := lib[key]
	if len(list) == 0 {
		return 0, nil, nil, fmt.Errorf("missing AG7 selected %s/%s bucket", mode, key)
	}
	index, err := rng.index(len(list))
	if err != nil {
		return 0, nil, nil, err
	}
	board, err := r.fill(list[index], mode, rng)
	return raw, &index, board, err
}
func (r *Runtime) Draw(ctx context.Context, request game.Request) (game.Result, error) {
	if err := ctx.Err(); err != nil {
		return game.Result{}, err
	}
	if _, err := payout(request.BetMinorUnits, 20000); err != nil {
		return game.Result{}, err
	}
	state := StateData{}
	initial := request.State.SchemaVersion == 0 && request.State.RuleType == "" && !request.State.Pending && (len(request.State.Payload) == 0 || string(request.State.Payload) == "null")
	if initial {
		if request.State.Version != "" && request.State.Version != r.Version() {
			return game.Result{}, fmt.Errorf("unknown initial AG7 version")
		}
	} else {
		var err error
		state, err = DecodeState(request.State)
		if err != nil {
			return game.Result{}, err
		}
		// Closed-round state contains only the sequence. It survives a release
		// switch; an in-progress feature remains pinned by its stored result and
		// the platform ticket, never by drawing another board from this state.
	}
	if state.Sequence == math.MaxUint64 {
		return game.Result{}, fmt.Errorf("AG7 sequence overflow")
	}
	rng := random{r.source}
	feature, err := rng.chance(string(r.config.Parameters.Trigger))
	if err != nil {
		return game.Result{}, err
	}
	out := outcome{NextSequence: state.Sequence + 1, Mode: "base", Boards: [][]int{}}
	if !feature {
		hit, err := rng.chance(string(r.config.Parameters.BaseWin))
		if err != nil {
			return game.Result{}, err
		}
		var board []int
		if hit {
			out.Multiplier, out.SkeletonIndex, board, err = r.winning("base", rng)
		} else {
			board, err = r.loss("base", rng)
		}
		if err != nil {
			return game.Result{}, err
		}
		out.Boards = append(out.Boards, board)
	} else {
		out.Mode = "free"
		raw, index, final, err := r.winning("free", rng)
		if err != nil {
			return game.Result{}, err
		}
		out.Multiplier, out.SkeletonIndex = raw, index
		key, err := r.lengths.pick(rng)
		if err != nil {
			return game.Result{}, err
		}
		base, _ := strconv.Atoi(key)
		for i := 0; i < base; i++ {
			if err = ctx.Err(); err != nil {
				return game.Result{}, err
			}
			board, err := r.loss("free", rng)
			if err != nil {
				return game.Result{}, err
			}
			out.Boards = append(out.Boards, board)
		}
		out.Boards = append(out.Boards, final)
	}
	if err = ctx.Err(); err != nil {
		return game.Result{}, err
	}
	return r.result(request.BetMinorUnits, out)
}
func payout(stake, raw int64) (int64, error) {
	if stake <= 0 || raw < 0 || raw > 20000 {
		return 0, fmt.Errorf("invalid AG7 payout input")
	}
	n := new(big.Int).Mul(big.NewInt(stake), big.NewInt(raw))
	n.Quo(n, big.NewInt(10))
	if !n.IsInt64() {
		return 0, fmt.Errorf("AG7 payout overflow")
	}
	return n.Int64(), nil
}
func (r *Runtime) ValidateStoredResult(out game.Result) error {
	if err := out.Validate(); err != nil {
		return err
	}
	if out.GameID != ID || out.RuleType != r.Type() || out.Version != r.Version() || out.ChargeMinorUnits != out.BetMinorUnits {
		return fmt.Errorf("AG7 stored identity/charge mismatch")
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
	expectedState, _ := DecodeState(expected.NextState)
	if state != expectedState || out.WinMinorUnits != expected.WinMinorUnits || len(out.Frames) != len(expected.Frames) {
		return fmt.Errorf("AG7 stored amount/state mismatch")
	}
	for i, frame := range out.Frames {
		plan := expected.Frames[i]
		if frame.WinMinorUnits != plan.WinMinorUnits || frame.NextAction != plan.NextAction {
			return fmt.Errorf("AG7 stored credit plan mismatch")
		}
		var a, b Display
		if err = strict(frame.Payload, &a); err != nil {
			return err
		}
		if err = strict(plan.Payload, &b); err != nil {
			return err
		}
		if !reflect.DeepEqual(a, b) {
			return fmt.Errorf("AG7 stored presentation mismatch")
		}
	}
	return nil
}
func (r *Runtime) Present(out game.Result, c game.FrameContext) (json.RawMessage, error) {
	if c.FrameIndex < 0 || c.FrameIndex >= len(out.Frames) {
		return nil, fmt.Errorf("invalid AG7 frame")
	}
	return append(json.RawMessage(nil), out.Frames[c.FrameIndex].Payload...), nil
}
