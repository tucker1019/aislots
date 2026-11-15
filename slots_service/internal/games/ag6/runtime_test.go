package ag6

import (
	game "aislots/slots_service/internal/domain/game"
	"context"
	"encoding/json"
	"errors"
	"io"
	"math"
	"math/rand"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"sync"
	"testing"
)

const release = "../../../testdata/deployments/2026-11-15-ag6/AG6"
const baseCandidate = "../../../../game_libraries/AG6/base/2026-11-14T17-46-24-753Z-540bb2c0"
const freeCandidate = "../../../../game_libraries/AG6/free/2026-11-14T17-46-24-803Z-12bfbdd6"

func components(t *testing.T) (Config, Library, Library) {
	t.Helper()
	c, err := LoadConfig(release)
	if err != nil {
		t.Fatal(err)
	}
	b, _, err := LoadLibrary(c, "base", filepath.Join(release, "base-library"))
	if err != nil {
		t.Fatal(err)
	}
	f, _, err := LoadLibrary(c, "free", filepath.Join(release, "free-library"))
	if err != nil {
		t.Fatal(err)
	}
	return c, b, f
}
func testRuntime(t *testing.T, feature, hit bool, baseRaw, freeRaw string) (*Runtime, *countReader) {
	t.Helper()
	c, b, f := components(t)
	c.Parameters.Trigger = "0"
	if feature {
		c.Parameters.Trigger = "1"
	}
	c.Parameters.BaseWin = "0"
	if hit {
		c.Parameters.BaseWin = "1"
	}
	c.Base = []WeightRow{{json.Number(baseRaw), "1"}}
	c.Free = []WeightRow{{json.Number(freeRaw), "1"}}
	reader := &countReader{source: rand.New(rand.NewSource(1019))}
	r, err := New(c, b, f, Options{Random: reader})
	if err != nil {
		t.Fatal(err)
	}
	return r, reader
}

type countReader struct {
	source io.Reader
	calls  int
}

func (r *countReader) Read(p []byte) (int, error) {
	r.calls++
	if r.source != nil {
		return r.source.Read(p)
	}
	clear(p)
	return len(p), nil
}

type errorReader struct{}

func (errorReader) Read([]byte) (int, error) { return 0, errors.New("entropy unavailable") }
func draw(t *testing.T, r *Runtime, stake int64) game.Result {
	t.Helper()
	out, err := r.Draw(context.Background(), game.Request{BetMinorUnits: stake})
	if err != nil {
		t.Fatal(err)
	}
	if err = r.ValidateStoredResult(out); err != nil {
		t.Fatal(err)
	}
	return out
}
func display(t *testing.T, f game.Frame) Display {
	t.Helper()
	var d Display
	if err := json.Unmarshal(f.Payload, &d); err != nil {
		t.Fatal(err)
	}
	return d
}

func TestRulesAndReplacementJackpot(t *testing.T) {
	c, _, _ := components(t)
	for _, tc := range []struct {
		board   []int
		raw     int64
		jackpot bool
	}{{[]int{2, 0, 0, 7, 0, 0, 2, 0, 0}, 5, false}, {[]int{5, 7, 7, 7, 7, 7, 7, 7, 7}, 1000, false}, {[]int{7, 7, 7, 7, 7, 7, 7, 7, 7}, 5000, true}} {
		e, err := Evaluate(c.Rules, tc.board, "base")
		if err != nil || e.RawPayout != tc.raw || e.Jackpot != tc.jackpot {
			t.Fatal(tc, e, err)
		}
		if tc.jackpot && len(e.LineWins) != 0 {
			t.Fatal("jackpot stacked lines")
		}
	}
	amount, err := payout(1000, 5)
	if err != nil || amount != 1000 {
		t.Fatal("orange total-bet example", amount, err)
	}
	for _, board := range [][]int{nil, {1, 1, 1, 1, 1, 1, 1, 1, 1}, {1, 1, 1, 7, 7, 7, 1, 1, 8}} {
		if _, err := Evaluate(c.Rules, board, "free"); err == nil {
			t.Fatal("invalid fixed center accepted")
		}
	}
}
func TestWholeFeaturePaysOnceAndEndsAtFirstWinningBoard(t *testing.T) {
	for _, raw := range []string{"3", "75", "200", "5000"} {
		t.Run(raw, func(t *testing.T) {
			r, _ := testRuntime(t, true, true, "1000", raw)
			out := draw(t, r, 103)
			m, _ := strconv.ParseInt(raw, 10, 64)
			want, _ := payout(103, m)
			if out.ChargeMinorUnits != 103 || out.WinMinorUnits != want || out.NextState.Pending {
				t.Fatal(out)
			}
			losses := len(out.Frames) - 1
			if losses < 1+lossExtra(m) || losses > 4+lossExtra(m) {
				t.Fatal("length", losses)
			}
			for i, f := range out.Frames {
				d := display(t, f)
				last := i == len(out.Frames)-1
				if d.Mode != "respin" || !d.GameData.Special || !reflect.DeepEqual(d.GameData.LockedCellIDs, []int{4, 5, 6}) || d.GameData.StageIndex != i+1 || d.GameData.StagesRemaining != len(out.Frames)-i-1 {
					t.Fatal(d)
				}
				if !last && (f.WinMinorUnits != 0 || len(d.Wins) != 0 || f.NextAction != "continue") {
					t.Fatal("early win", i, f)
				}
				if last && (f.WinMinorUnits != want || f.NextAction != "complete") {
					t.Fatal("final credit", f)
				}
				var sum int64
				for _, p := range d.GameData.Replay.Payouts {
					n, _ := strconv.ParseInt(p.Amount, 10, 64)
					sum += n
				}
				if sum != f.WinMinorUnits {
					t.Fatal("item credit sum", sum, f)
				}
				for _, cell := range d.Board[1] {
					if cell.SymbolID != 7 {
						t.Fatal("center changed")
					}
				}
			}
			if raw == "5000" {
				d := display(t, out.Frames[len(out.Frames)-1])
				if len(d.Wins) != 1 || !d.GameData.Jackpot || d.Wins[0].RawPayout != "5000" {
					t.Fatal(d)
				}
			}
		})
	}
}
func TestOrdinaryLossAndWinHaveOneFrame(t *testing.T) {
	for _, hit := range []bool{false, true} {
		r, _ := testRuntime(t, false, hit, "5", "5000")
		out := draw(t, r, 1000)
		want := int64(0)
		if hit {
			want = 1000
		}
		if len(out.Frames) != 1 || out.WinMinorUnits != want || display(t, out.Frames[0]).Mode != "base" {
			t.Fatal(out)
		}
	}
}
func TestEveryCandidateSinglePassFillAndLiveLoss(t *testing.T) {
	c, b, f := components(t)
	r, err := New(c, b, f, Options{})
	if err != nil {
		t.Fatal(err)
	}
	for mode, lib := range map[string]Library{"base": b, "free": f} {
		for key, list := range lib {
			for _, s := range list {
				fixed, before, err := Inspect(c.Rules, s, mode)
				if err != nil {
					t.Fatal(err)
				}
				for _, source := range []io.Reader{&countReader{}, rand.New(rand.NewSource(42)), rand.New(rand.NewSource(1019))} {
					filled, err := r.fill(s, mode, random{source})
					if err != nil {
						t.Fatal(mode, key, err)
					}
					after, _ := Evaluate(c.Rules, filled, mode)
					if !reflect.DeepEqual(before, after) {
						t.Fatal("award changed")
					}
					for p, id := range fixed {
						if id > 0 && filled[p] != id {
							t.Fatal("fixed changed")
						}
					}
				}
				source := &countReader{}
				if _, err = r.fill(s, mode, random{source}); err != nil {
					t.Fatal(err)
				}
				if source.calls != 9-len(s.Cells)/2 {
					t.Fatal("more than one pick per hole", source.calls, s)
				}
			}
		}
		for i := 0; i < 1000; i++ {
			source := &countReader{}
			board, err := r.loss(mode, random{source})
			if err != nil {
				t.Fatal(err)
			}
			e, _ := Evaluate(c.Rules, board, mode)
			want := 9
			if mode == "free" {
				want = 6
			}
			if e.RawPayout != 0 || source.calls != want {
				t.Fatal("loss retried or paid", e, source.calls)
			}
		}
	}
	source := &countReader{}
	if _, err = r.fill(Skeleton{Cells: []int{0, 7, 3, 7}}, "base", random{source}); err == nil || source.calls != 0 {
		t.Fatal("invalid skeleton consumed entropy")
	}
}
func TestStoredTamperingRejectedAndPresentationUsesNoEntropy(t *testing.T) {
	r, reader := testRuntime(t, true, true, "5", "1000")
	original := draw(t, r, 107)
	calls := reader.calls
	for i := range original.Frames {
		a, err := r.Present(original, game.FrameContext{FrameIndex: i})
		if err != nil || !reflect.DeepEqual(a, original.Frames[i].Payload) {
			t.Fatal(err)
		}
		a[0] = 'x'
	}
	if reader.calls != calls {
		t.Fatal("presentation sampled")
	}
	for _, mutate := range []func(*game.Result){
		func(o *game.Result) { o.WinMinorUnits++ }, func(o *game.Result) { o.ChargeMinorUnits = 0 }, func(o *game.Result) { o.GameID = "AG4" }, func(o *game.Result) { o.NextState.Payload = json.RawMessage(`{"sequence":999}`) },
		func(o *game.Result) { o.Frames[0].WinMinorUnits = 1; o.Frames[len(o.Frames)-1].WinMinorUnits-- },
		func(o *game.Result) {
			var d Display
			_ = json.Unmarshal(o.Frames[0].Payload, &d)
			d.Board[1][0].SymbolID = 1
			o.Frames[0].Payload, _ = json.Marshal(d)
		},
		func(o *game.Result) {
			var x outcome
			_ = json.Unmarshal(o.Payload, &x)
			x.Boards[0] = append([]int{}, x.Boards[len(x.Boards)-1]...)
			o.Payload, _ = json.Marshal(x)
		},
		func(o *game.Result) {
			var x outcome
			_ = json.Unmarshal(o.Payload, &x)
			x.SkeletonIndex = nil
			o.Payload, _ = json.Marshal(x)
		},
		func(o *game.Result) { o.Frames = o.Frames[1:] },
	} {
		raw, _ := json.Marshal(original)
		var out game.Result
		_ = json.Unmarshal(raw, &out)
		mutate(&out)
		if err := r.ValidateStoredResult(out); err == nil {
			t.Fatal("tamper accepted")
		}
	}
	if _, err := r.Present(original, game.FrameContext{FrameIndex: -1}); err == nil {
		t.Fatal("bad frame")
	}
}
func TestStateErrorsCancellationEntropyAndOverflow(t *testing.T) {
	r, reader := testRuntime(t, false, true, "5", "3")
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := r.Draw(ctx, game.Request{BetMinorUnits: 100}); err == nil || reader.calls != 0 {
		t.Fatal(err)
	}
	for _, stake := range []int64{0, -1, math.MaxInt64} {
		if _, err := r.Draw(context.Background(), game.Request{BetMinorUnits: stake}); err == nil {
			t.Fatal("bad stake")
		}
	}
	out := draw(t, r, 100)
	for _, modify := range []func(*game.State){func(s *game.State) { s.Pending = true }, func(s *game.State) { s.SchemaVersion = 2 }, func(s *game.State) { s.Version = RuleType + ":" + string(make([]byte, 64)) }, func(s *game.State) { s.Payload = json.RawMessage(`{"sequence":18446744073709551615}`) }} {
		state := out.NextState
		modify(&state)
		if _, err := r.Draw(context.Background(), game.Request{BetMinorUnits: 100, State: state}); err == nil {
			t.Fatal("bad state")
		}
	}
	c, b, f := components(t)
	previous := out.NextState
	previous.Version = RuleType + ":" + "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	continued, err := r.Draw(context.Background(), game.Request{BetMinorUnits: 100, State: previous})
	if err != nil {
		t.Fatal("closed-round sequence did not survive release switch", err)
	}
	next, err := DecodeState(continued.NextState)
	if err != nil || next.Sequence != 2 {
		t.Fatal("sequence after release switch", next, err)
	}
	bad, err := New(c, b, f, Options{Random: errorReader{}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err = bad.Draw(context.Background(), game.Request{BetMinorUnits: 100}); err == nil {
		t.Fatal("entropy error masked")
	}
}
func TestExactWeightsZeroJackpotAndMixture(t *testing.T) {
	c, b, f := components(t)
	c.Parameters.Trigger = "0.2"
	c.Parameters.BaseWin = "0.5"
	c.Base = []WeightRow{{"5", "1"}, {"10", "1"}, {"5000", "0"}}
	c.Free = []WeightRow{{"25", "1"}, {"50", "1"}, {"5000", "0"}}
	r, err := New(c, b, f, Options{Random: rand.New(rand.NewSource(42))})
	if err != nil {
		t.Fatal(err)
	}
	sum := int64(0)
	special := 0
	for i := 0; i < 10000; i++ {
		out := draw(t, r, 100)
		sum += out.WinMinorUnits
		if len(out.Frames) > 1 {
			special++
		}
		if out.WinMinorUnits >= 100000 {
			t.Fatal("zero-weight jackpot selected")
		}
	}
	actual := float64(sum) / 1000000
	if math.Abs(actual-2.1) > .15 || math.Abs(float64(special)/10000-.2) > .025 {
		t.Fatal("mixture", actual, special)
	}
	w, err := newWeighted([]string{"a", "b", "zero"}, []string{"0.000000001", "0.000000002", "0"})
	if err != nil || w.total.String() != "3" || len(w.keys) != 2 {
		t.Fatal(w, err)
	}
}
func TestImmutableReleaseAndCoverage(t *testing.T) {
	c, b, f := components(t)
	if len(b) != 313 || len(f) != 268 {
		t.Fatal(len(b), len(f))
	}
	destination := filepath.Join(t.TempDir(), "AG6")
	if err := Publish("../../../../game_configs/AG6", baseCandidate, freeCandidate, destination); err != nil {
		t.Fatal(err)
	}
	if err := Publish("../../../../game_configs/AG6", baseCandidate, freeCandidate, destination); err == nil {
		t.Fatal("overwrote release")
	}
	if _, err := Load(destination, filepath.Join(destination, "base-library"), filepath.Join(destination, "free-library"), Options{}); err != nil {
		t.Fatal(err)
	}
	delete(b, "3")
	raw, _ := json.Marshal(b)
	if _, _, _, err := ValidateLibrary(c, "base", raw); err == nil {
		t.Fatal("missing bucket accepted")
	}
	raw, _ = json.Marshal(f)
	var corrupt map[string]json.RawMessage
	_ = json.Unmarshal(raw, &corrupt)
	corrupt["3"] = json.RawMessage(`[{"cells":[0,1,3,7,4,7,5,7,6,1],"money":1}]`)
	raw, _ = json.Marshal(corrupt)
	if _, _, _, err := ValidateLibrary(c, "free", raw); err == nil {
		t.Fatal("extra money accepted")
	}
	file := filepath.Join(destination, "base-library", "library.json")
	if err := os.WriteFile(file, []byte("{}"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(destination, filepath.Join(destination, "base-library"), filepath.Join(destination, "free-library"), Options{}); err == nil {
		t.Fatal("bad hash accepted")
	}
}
func TestConcurrentImmutableRuntime(t *testing.T) {
	r, _ := testRuntime(t, true, true, "5", "3")
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 5; j++ {
				draw(t, r, 100)
			}
		}()
	}
	wg.Wait()
}

func TestInvalidConfigurationAndSnapshotIsolation(t *testing.T) {
	c, b, f := components(t)
	for _, mutate := range []func(*Config){
		func(c *Config) { c.Parameters.LineCount = 10 },
		func(c *Config) { c.Parameters.FreeWin = "0.5" },
		func(c *Config) { c.Parameters.BaseWin = "-0.1" },
		func(c *Config) { c.Parameters.Trigger = "1.1" },
		func(c *Config) { c.Rules.JackpotRaw = 1000 },
		func(c *Config) { c.Rules.Symbols[0].Weight = "0" },
		func(c *Config) { c.Rules.Symbols[0].Payout = 5 },
		func(c *Config) { c.Base = []WeightRow{{"0", "1"}} },
		func(c *Config) { c.Base = []WeightRow{{"3.5", "1"}} },
		func(c *Config) { c.Base = []WeightRow{{"3", "1"}, {"3", "1"}} },
		func(c *Config) { c.Free = []WeightRow{{"3", "0"}} },
	} {
		raw, _ := json.Marshal(c)
		var copy Config
		_ = json.Unmarshal(raw, &copy)
		mutate(&copy)
		if err := copy.Validate(); err == nil {
			t.Fatal("invalid configuration accepted")
		}
	}
	r, err := New(c, b, f, Options{Random: &countReader{}})
	if err != nil {
		t.Fatal(err)
	}
	version := r.Version()
	c.Rules.Symbols[0].Payout = 999
	c.Base[0][1] = "0"
	b["3"][0].Cells[0] = 100
	if r.Version() != version || r.config.Rules.Symbols[0].Payout != 3 || r.base["3"][0].Cells[0] == 100 {
		t.Fatal("runtime aliases mutable inputs")
	}
}

func TestClientExamples(t *testing.T) {
	type ExampleFrame struct {
		Step    int     `json:"stepIndex"`
		Charge  int64   `json:"chargeAmount"`
		Win     int64   `json:"winAmount"`
		Balance int64   `json:"balance"`
		Next    string  `json:"nextAction"`
		Display Display `json:"display"`
	}
	type Example struct {
		Bet    int64          `json:"betAmount"`
		Win    int64          `json:"totalWinAmount"`
		Frames []ExampleFrame `json:"frames"`
	}
	examples := map[string]Example{}
	for _, tc := range []struct {
		name         string
		feature, hit bool
		raw          string
	}{
		{"ordinary_loss", false, false, "5"}, {"ordinary_orange", false, true, "5"}, {"ordinary_non_jackpot_1000", false, true, "1000"}, {"ordinary_jackpot", false, true, "5000"}, {"special_orange", true, true, "5"}, {"special_jackpot", true, true, "5000"},
	} {
		baseRaw, freeRaw := tc.raw, tc.raw
		r, reader := testRuntime(t, tc.feature, tc.hit, baseRaw, freeRaw)
		reader.source = nil
		out := draw(t, r, 1000)
		balance := int64(500000)
		example := Example{Bet: 1000, Win: out.WinMinorUnits, Frames: []ExampleFrame{}}
		for i, f := range out.Frames {
			charge := int64(0)
			if i == 0 {
				charge = 1000
			}
			balance += f.WinMinorUnits - charge
			example.Frames = append(example.Frames, ExampleFrame{i + 1, charge, f.WinMinorUnits, balance, f.NextAction, display(t, f)})
		}
		examples[tc.name] = example
	}
	raw, err := json.MarshalIndent(examples, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	raw = append(raw, '\n')
	file := "../../../testdata/ag6-client-examples.json"
	if os.Getenv("AG6_WRITE_EXAMPLES") == "1" {
		if err = os.WriteFile(file, raw, 0644); err != nil {
			t.Fatal(err)
		}
	}
	expected, err := os.ReadFile(file)
	if err != nil {
		t.Fatal("generate AG6_WRITE_EXAMPLES=1", err)
	}
	if string(expected) != string(raw) {
		t.Fatal("AG6 client examples are stale")
	}
}
