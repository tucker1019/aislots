package ag10

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"math/rand"
	"os"
	"reflect"
	"strconv"
	"strings"
	"sync"
	"testing"

	game "aislots/slots_service/internal/domain/game"
)

func testConfig(t *testing.T) Config {
	t.Helper()
	c, err := LoadConfig("../../../../game_configs/AG10")
	if err != nil {
		t.Fatal(err)
	}
	return c
}
func skeletonFor(t *testing.T, c Rules, board []int, mode string) Skeleton {
	t.Helper()
	e, err := Evaluate(c, board, mode)
	if err != nil || e.RawPayout == 0 {
		t.Fatal(e, err)
	}
	s := Skeleton{}
	for _, id := range e.WinningCellIDs {
		s.Cells = append(s.Cells, id-1, board[id-1])
	}
	return s
}
func testRuntime(t *testing.T, options Options) *Runtime {
	t.Helper()
	c := testConfig(t)
	c.Parameters.BaseWin = "0.5"
	c.Parameters.FreeWin = "0.5"
	c.Parameters.Trigger = "0.5"
	c.Base = []WeightRow{{"100", "1"}, {"285", "1"}, {"20000", "1"}}
	c.Free = []WeightRow{{"25", "1"}, {"7000", "1"}, {"10000", "1"}, {"20000", "1"}}
	b := Library{}
	f := Library{}
	add := func(lib Library, mode string, board []int) {
		e, _ := Evaluate(c.Rules, board, mode)
		lib[strconv.FormatInt(e.RawPayout, 10)] = []Skeleton{skeletonFor(t, c.Rules, board, mode)}
	}
	add(b, "base", []int{6, 0, 0, 6, 0, 0, 0, 6, 0, 0})
	add(b, "base", []int{6, 11, 12, 6, 13, 14, 15, 6, 0, 0})
	add(b, "base", []int{19, 19, 19, 19, 19, 19, 19, 19, 19, 19})
	add(f, "free", []int{11, 11, 11, 11, 11, 0, 0, 0, 0, 0})
	add(f, "free", []int{19, 19, 19, 17, 17, 0, 0, 0, 0, 0})
	add(f, "free", []int{19, 19, 19, 19, 19, 0, 0, 0, 0, 0})
	add(f, "free", []int{19, 19, 19, 19, 19, 19, 19, 19, 19, 19})
	r, err := New(c, b, f, options)
	if err != nil {
		t.Fatal(err)
	}
	return r
}
func spin(t *testing.T, r *Runtime, mode string, key int64) SpinOutcome {
	t.Helper()
	if key == 0 {
		board, err := r.loss(mode, random{rand.New(rand.NewSource(1018))})
		if err != nil {
			t.Fatal(err)
		}
		return SpinOutcome{Mode: mode, Board: board}
	}
	lib := r.base
	if mode == "free" {
		lib = r.free
	}
	index := 0
	board, err := r.fill(lib[strconv.FormatInt(key, 10)][0], mode, random{rand.New(rand.NewSource(key))})
	if err != nil {
		t.Fatal(err)
	}
	return SpinOutcome{Mode: mode, Board: board, Multiplier: key, SkeletonIndex: &index}
}
func decodeDisplay(t *testing.T, f game.Frame) Display {
	t.Helper()
	var d Display
	if err := strict(f.Payload, &d); err != nil {
		t.Fatal(err)
	}
	return d
}

func TestRulesLinesRewardsAndNoAccumulation(t *testing.T) {
	c := testConfig(t).Rules
	cases := []struct {
		board             []int
		mode              string
		raw, line, reward int64
	}{
		{[]int{6, 11, 12, 6, 13, 14, 15, 6, 0, 0}, "base", 285, 100, 185},
		{[]int{11, 12, 13, 0, 0, 0, 0, 0, 0, 0}, "free", 0, 0, 0},
		{[]int{14, 15, 0, 0, 0, 0, 0, 0, 0, 0}, "free", 0, 0, 0},
		{[]int{11, 12, 13, 14, 15, 16, 0, 0, 0, 0}, "free", 385, 0, 385},
		{[]int{7, 7, 7, 7, 7, 7, 7, 7, 7, 7}, "base", 2000, 2000, 0},
	}
	for _, tc := range cases {
		e, err := Evaluate(c, tc.board, tc.mode)
		if err != nil || e.RawPayout != tc.raw || e.LinePayout != tc.line || e.RewardPayout != tc.reward {
			t.Fatal(e, tc, err)
		}
	}
	if _, err := Evaluate(c, []int{1, 1, 1, 1, 1, 1, 1, 1, 1, 1}, "free"); err == nil {
		t.Fatal("ordinary in special")
	}
}

type zeroReader struct{ calls int }

func (r *zeroReader) Read(p []byte) (int, error) { r.calls++; clear(p); return len(p), nil }

type errorReader struct{}

func (errorReader) Read([]byte) (int, error) { return 0, errors.New("entropy unavailable") }

func TestFillIsSinglePassAndRejectsImpossibleBeforeDrawing(t *testing.T) {
	r := testRuntime(t, Options{})
	for key, list := range r.base {
		for _, s := range list {
			for seed := int64(0); seed < 100; seed++ {
				board, err := r.fill(s, "base", random{rand.New(rand.NewSource(seed))})
				if err != nil {
					t.Fatal(err)
				}
				e, _ := Evaluate(r.config.Rules, board, "base")
				if strconv.FormatInt(e.RawPayout, 10) != key {
					t.Fatal("changed prize")
				}
				for i := 0; i < len(s.Cells); i += 2 {
					if board[s.Cells[i]] != s.Cells[i+1] {
						t.Fatal("changed fixed cell")
					}
				}
			}
			reader := &zeroReader{}
			if _, err := r.fill(s, "base", random{reader}); err != nil {
				t.Fatal(err)
			}
			if reader.calls != 10-len(s.Cells)/2 {
				t.Fatal("not one draw per hole", key, reader.calls)
			}
		}
	}
	// These two winning lines leave [1,5,8] as Wild/Wild/hole.
	s := Skeleton{Cells: []int{1, 7, 4, 7, 0, 6, 7, 6, 5, 6, 9, 6}}
	reader := &zeroReader{}
	if _, err := r.fill(s, "base", random{reader}); err == nil || reader.calls != 0 {
		t.Fatal("impossible fill sampled", err, reader.calls)
	}
	if _, err := r.fill(r.base["100"][0], "base", random{errorReader{}}); err == nil {
		t.Fatal("entropy failure hidden")
	}
}
func TestLossConstructionBoundedAndRewardPositionsVary(t *testing.T) {
	r := testRuntime(t, Options{})
	seen := map[int]bool{}
	for _, mode := range []string{"base", "free"} {
		for seed := int64(0); seed < 1000; seed++ {
			board, err := r.loss(mode, random{rand.New(rand.NewSource(seed))})
			if err != nil {
				t.Fatal(err)
			}
			e, _ := Evaluate(r.config.Rules, board, mode)
			if e.RawPayout != 0 || len(e.Rewards) > 4 {
				t.Fatal("not a loss", e)
			}
			for _, cell := range e.Rewards {
				seen[cell.CellID] = true
			}
			for _, id := range board {
				if r.wild[id] || (mode == "base" && id == 0) {
					t.Fatal("illegal filler")
				}
			}
		}
	}
	if len(seen) != 10 {
		t.Fatal("fixed reward positions", seen)
	}
}
func TestEightSpecialSpinsPayImmediatelyAndCapHeadroom(t *testing.T) {
	r := testRuntime(t, Options{})
	o := outcome{NextSequence: 1, Triggered: true, Spins: []SpinOutcome{spin(t, r, "base", 100)}}
	for i := 0; i < 8; i++ {
		o.Spins = append(o.Spins, spin(t, r, "free", 25))
	}
	result, err := r.result(100, o)
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Frames) != 9 || result.WinMinorUnits != 3000 {
		t.Fatal(result)
	}
	for i, f := range result.Frames {
		d := decodeDisplay(t, f)
		want := int64(250)
		if i == 0 {
			want = 1000
		}
		if f.WinMinorUnits != want || d.FreeRemaining != 8-i || d.GameData.SpecialIndex != i {
			t.Fatal(i, f, d)
		}
	}
	if err = r.ValidateStoredResult(result); err != nil {
		t.Fatal(err)
	}
	capped := outcome{NextSequence: 2, Triggered: true, Spins: []SpinOutcome{spin(t, r, "base", 20000), spin(t, r, "free", 20000), spin(t, r, "free", 7000), spin(t, r, "free", 10000)}}
	result, err = r.result(100, capped)
	if err != nil {
		t.Fatal(err)
	}
	last := decodeDisplay(t, result.Frames[3])
	if result.WinMinorUnits != 500000 || result.Frames[3].WinMinorUnits != 30000 || last.GameData.DueAmount != 100000 || last.GameData.TruncatedAmount != 70000 || !last.GameData.Capped || last.FreeRemaining != 0 || result.Frames[3].NextAction != "complete" {
		t.Fatal(result, last)
	}
	var total int64
	for _, p := range last.GameData.Replay.Payouts {
		n, _ := strconv.ParseInt(p.Amount, 10, 64)
		total += n
	}
	if total != 30000 {
		t.Fatal("paid details", total)
	}
	if err = r.ValidateStoredResult(result); err != nil {
		t.Fatal(err)
	}
	// A new special board never retains a preceding spin's reward cells.
	zero := outcome{NextSequence: 3, Triggered: true, Spins: []SpinOutcome{spin(t, r, "base", 100)}}
	for i := 0; i < 8; i++ {
		zero.Spins = append(zero.Spins, spin(t, r, "free", 0))
	}
	result, err = r.result(100, zero)
	if err != nil {
		t.Fatal(err)
	}
	if result.WinMinorUnits != 1000 {
		t.Fatal("accumulated rewards")
	}
}
func TestExactCurrencyRoundingAndOverflow(t *testing.T) {
	r := testRuntime(t, Options{})
	o := outcome{NextSequence: 1, Triggered: true, Spins: []SpinOutcome{spin(t, r, "base", 100)}}
	for i := 0; i < 8; i++ {
		o.Spins = append(o.Spins, spin(t, r, "free", 25))
	}
	result, err := r.result(1, o)
	if err != nil || result.WinMinorUnits != 30 {
		t.Fatal("cumulative floors", result, err)
	}
	for _, f := range result.Frames {
		d := decodeDisplay(t, f)
		var sum int64
		for _, p := range d.GameData.Replay.Payouts {
			n, _ := strconv.ParseInt(p.Amount, 10, 64)
			sum += n
		}
		if sum != f.WinMinorUnits {
			t.Fatal("fraction allocation", d)
		}
	}
	reader := &zeroReader{}
	r = testRuntime(t, Options{Random: reader})
	if _, err = r.Draw(context.Background(), game.Request{BetMinorUnits: math.MaxInt64}); err == nil || reader.calls != 0 {
		t.Fatal("overflow drew", err, reader.calls)
	}
	if _, err = payout(math.MaxInt64, 100); err == nil {
		t.Fatal("overflow")
	}
}

func TestMultiplierWeightsIgnoreSkeletonCounts(t *testing.T) {
	fixture := testRuntime(t, Options{})
	for _, copies := range []int{1, 30} {
		c := fixture.config
		c.Parameters.BaseWin, c.Parameters.Trigger = "1", "0"
		c.Base = []WeightRow{{"100", "3"}, {"285", "1"}}
		base := Library{}
		for key, list := range fixture.base {
			base[key] = append([]Skeleton(nil), list...)
		}
		for i := 1; i < copies; i++ {
			base["285"] = append(base["285"], base["285"][0])
		}
		r, err := New(c, base, fixture.free, Options{Random: rand.New(rand.NewSource(1018))})
		if err != nil {
			t.Fatal(err)
		}
		hits := 0
		for i := 0; i < 1000; i++ {
			out, err := r.Draw(context.Background(), game.Request{BetMinorUnits: 100})
			if err != nil {
				t.Fatal(err)
			}
			if out.WinMinorUnits == 1000 {
				hits++
			} else if out.WinMinorUnits != 2850 {
				t.Fatal("unexpected payout", out.WinMinorUnits)
			}
		}
		if hits < 650 || hits > 850 {
			t.Fatal("skeleton count changed multiplier probability", copies, hits)
		}
	}
}

func TestOrdinaryCapStopsBeforeTriggerAndStateContinues(t *testing.T) {
	fixture := testRuntime(t, Options{})
	c := fixture.config
	c.Parameters.BaseWin, c.Parameters.Trigger = "1", "1"
	c.Rules.Rewards[8].Payout = 10000
	c.Base = []WeightRow{{"100000", "1"}}
	c.Free = []WeightRow{{"50000", "1"}}
	board := []int{19, 19, 19, 19, 19, 19, 19, 19, 19, 19}
	base := Library{"100000": {skeletonFor(t, c.Rules, board, "base")}}
	free := Library{"50000": {skeletonFor(t, c.Rules, []int{19, 19, 19, 19, 19, 0, 0, 0, 0, 0}, "free")}}
	r, err := New(c, base, free, Options{Random: rand.New(rand.NewSource(1018))})
	if err != nil {
		t.Fatal(err)
	}
	first, err := r.Draw(context.Background(), game.Request{BetMinorUnits: 100})
	if err != nil {
		t.Fatal(err)
	}
	d := decodeDisplay(t, first.Frames[0])
	if len(first.Frames) != 1 || first.WinMinorUnits != 500000 || d.TriggeredFree || !d.GameData.Capped || d.FreeRemaining != 0 {
		t.Fatal(first, d)
	}
	second, err := r.Draw(context.Background(), game.Request{BetMinorUnits: 100, State: first.NextState})
	if err != nil {
		t.Fatal(err)
	}
	state, err := DecodeState(second.NextState)
	if err != nil || state.Sequence != 2 {
		t.Fatal(state, err)
	}
	if err = r.ValidateStoredResult(first); err != nil {
		t.Fatal(err)
	}
}
func TestStoredOutcomeValidationAndPrivatePresentation(t *testing.T) {
	r := testRuntime(t, Options{Random: rand.New(rand.NewSource(1018))})
	for i := 0; i < 100; i++ {
		out, err := r.Draw(context.Background(), game.Request{BetMinorUnits: 100})
		if err != nil {
			t.Fatal(err)
		}
		if err = r.ValidateStoredResult(out); err != nil {
			t.Fatal(err)
		}
		for j := range out.Frames {
			data, err := r.Present(out, game.FrameContext{FrameIndex: j})
			if err != nil || string(data) != string(out.Frames[j].Payload) || strings.Contains(string(data), "spins") || strings.Contains(string(data), "skeletonIndex") {
				t.Fatal("future leak", err)
			}
		}
		copy := out
		copy.WinMinorUnits++
		if r.ValidateStoredResult(copy) == nil {
			t.Fatal("altered credit accepted")
		}
		copy = out
		copy.NextState.Pending = true
		if r.ValidateStoredResult(copy) == nil {
			t.Fatal("pending state accepted")
		}
		var d Display
		_ = json.Unmarshal(copy.Frames[0].Payload, &d)
		d.GameData.RawPayout++
		copy = out
		copy.Frames = append([]game.Frame(nil), out.Frames...)
		copy.Frames[0].Payload, _ = json.Marshal(d)
		if r.ValidateStoredResult(copy) == nil {
			t.Fatal("altered presentation accepted")
		}
	}
	o := outcome{NextSequence: 1, Triggered: true, Spins: []SpinOutcome{spin(t, r, "base", 100), spin(t, r, "free", 25)}}
	if _, err := r.result(100, o); err == nil {
		t.Fatal("early stop accepted")
	}
	o = outcome{NextSequence: 1, Spins: []SpinOutcome{spin(t, r, "base", 100)}}
	o.Spins[0].Board[0] = 1
	if _, err := r.result(100, o); err == nil {
		t.Fatal("changed fixed cell accepted")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := r.Draw(ctx, game.Request{BetMinorUnits: 100}); err == nil {
		t.Fatal("cancel ignored")
	}
	bad := game.State{RuleType: RuleType, Version: r.Version(), SchemaVersion: 99, Payload: json.RawMessage(`{"sequence":0}`)}
	if _, err := r.Draw(context.Background(), game.Request{BetMinorUnits: 100, State: bad}); err == nil {
		t.Fatal("schema accepted")
	}
}
func TestSnapshotsAndConcurrentDraws(t *testing.T) {
	r := testRuntime(t, Options{Random: rand.New(rand.NewSource(1))})
	before := r.Version()
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 25; j++ {
				out, err := r.Draw(context.Background(), game.Request{BetMinorUnits: 100})
				if err != nil {
					t.Error(err)
					return
				}
				if err = r.ValidateStoredResult(out); err != nil {
					t.Error(err)
					return
				}
			}
		}()
	}
	wg.Wait()
	if before != r.Version() {
		t.Fatal("version mutated")
	}
	c := testConfig(t)
	c.Parameters.BaseWin = "0"
	c.Parameters.FreeWin = "0"
	c.Parameters.Trigger = "0"
	b := r.base
	f := r.free
	c.Base = []WeightRow{{"100", "1"}, {"285", "1"}, {"20000", "1"}}
	c.Free = []WeightRow{{"25", "1"}, {"7000", "1"}, {"10000", "1"}, {"20000", "1"}}
	other, err := New(c, b, f, Options{})
	if err != nil {
		t.Fatal(err)
	}
	version := other.Version()
	c.Parameters.BaseWin = "1"
	b["100"][0].Cells[0] = 9
	if other.Version() != version || reflect.DeepEqual(other.base["100"], b["100"]) {
		t.Fatal("mutable snapshot")
	}
}

func TestClientExamples(t *testing.T) {
	r := testRuntime(t, Options{})
	ordinary := outcome{NextSequence: 1, Triggered: true, Spins: []SpinOutcome{spin(t, r, "base", 100)}}
	for i := 1; i <= 8; i++ {
		key := int64(0)
		if i == 2 {
			key = 25
		}
		ordinary.Spins = append(ordinary.Spins, spin(t, r, "free", key))
	}
	cap := outcome{NextSequence: 2, Triggered: true, Spins: []SpinOutcome{spin(t, r, "base", 20000), spin(t, r, "free", 20000), spin(t, r, "free", 7000), spin(t, r, "free", 10000)}}
	fixture := map[string]any{"note": "固定结果联调样例，使用独立测试倍率表覆盖流程；不代表已保存数值配置的抽样概率。"}
	for name, o := range map[string]outcome{"trigger_loss_win_end": ordinary, "cap": cap} {
		result, err := r.result(100, o)
		if err != nil {
			t.Fatal(err)
		}
		if err = r.ValidateStoredResult(result); err != nil {
			t.Fatal(err)
		}
		frames := []map[string]any{}
		var total int64
		for i, f := range result.Frames {
			var data map[string]any
			_ = json.Unmarshal(f.Payload, &data)
			total += f.WinMinorUnits
			data["betId"] = name + "-example"
			data["requestId"] = fmtID(i)
			data["nextRequestId"] = fmtID(i + 1)
			data["spinIndex"] = 0
			data["stepIndex"] = i + 1
			data["status"] = "ready"
			data["nextAction"] = f.NextAction
			data["winAmount"] = f.WinMinorUnits
			data["totalWinAmount"] = total
			data["betAmount"] = 100
			data["balance"] = 1000000 - 100 + total
			frames = append(frames, map[string]any{"code": "OK", "data": data})
		}
		fixture[name] = frames
	}
	raw, err := json.MarshalIndent(fixture, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	raw = append(raw, '\n')
	path := "../../../testdata/ag10-client-examples.json"
	if os.Getenv("AG10_WRITE_EXAMPLES") == "1" {
		if err = os.WriteFile(path, raw, 0644); err != nil {
			t.Fatal(err)
		}
	}
	want, err := os.ReadFile(path)
	if err != nil {
		t.Fatal("generate examples with AG10_WRITE_EXAMPLES=1", err)
	}
	if string(want) != string(raw) {
		t.Fatal("client samples stale")
	}
}
func fmtID(i int) string { return "example-token-" + strconv.Itoa(i) }
