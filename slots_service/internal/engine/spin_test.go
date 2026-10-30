package engine

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"reflect"
	"sync"
	"testing"
)

func fixture() (Game, *MemoryLibrary) {
	n := 100.0
	limit := 0
	g := Game{ID: "TEST", Parameters: Parameters{LineCount: 20, BaseWin: 1, FreeWin: 1, Awards: [][2]float64{{2, 1}}, RetriggerLimit: &limit}, Board: BoardConfig{Version: 1, ColumnHeights: []int{2, 2, 2, 2, 2}, CascadeFactors: []json.Number{"1", "2"}, FreeCascadeFactors: []json.Number{"2", "4"}, FillWeightIncrement: &n, ScatterWeightIncrement: &n, Gold: Gold{Columns: []int{}}}, BaseRows: []WeightRow{{"2", "1"}}, FreeRows: []WeightRow{{"4", "1"}}}
	for i := 1; i <= 6; i++ {
		g.Board.Symbols = append(g.Board.Symbols, Symbol{ID: json.Number(string(rune('0' + i))).String(), Role: "normal", Weight: 100, Payouts: map[int]json.Number{3: "2", 4: "3", 5: "4"}})
	}
	g.Board.Symbols = append(g.Board.Symbols, Symbol{ID: "11", Role: "scatter", Weight: 30, Payouts: map[int]json.Number{}})
	skeleton := []int{3, 0, 1, 2, 1, 4, 1, 0}
	return g, NewMemoryLibrary(map[Mode]map[string][][]int{Base: {"2": {skeleton}}, Free: {"4": {skeleton}}})
}
func seeded(seed uint32) func() (float64, error) {
	return func() (float64, error) {
		seed += 0x6D2B79F5
		t := seed
		t = (t ^ (t >> 15)) * (t | 1)
		t ^= t + ((t ^ (t >> 7)) * (t | 61))
		return float64(t^(t>>14)) / 4294967296, nil
	}
}
func engine(t *testing.T, g Game, m SkeletonStore) *Engine {
	t.Helper()
	e, err := NewEngine(g, m, Options{TriggerSymbolCount: 3, Random: seeded(42)})
	if err != nil {
		t.Fatal(err)
	}
	return e
}
func TestPaidAndLoss(t *testing.T) {
	for _, hit := range []bool{true, false} {
		t.Run(map[bool]string{true: "win", false: "loss"}[hit], func(t *testing.T) {
			g, m := fixture()
			if !hit {
				g.Parameters.BaseWin = 0
			}
			e := engine(t, g, m)
			out, err := e.Spin(context.Background(), SpinRequest{BetMinorUnits: 101})
			if err != nil {
				t.Fatal(err)
			}
			want := int64(10)
			key := "2"
			streak := int64(1)
			if !hit {
				want = 0
				key = "0"
				streak = -1
			}
			if out.WinMinorUnits != want || out.Round.RawMultiplier != key || out.NextState.Streak != streak || out.ChargeMinorUnits != 101 {
				t.Fatalf("bad payout: %+v", out)
			}
			if out.Round.FreeSymbols > 2 {
				t.Fatal("too many scatter")
			}
			if err = e.validateRound(out.Round, Base); err != nil {
				t.Fatal(err)
			}
			if hit && out.ExactWinMinorUnits != "10.1" {
				t.Fatal(out.ExactWinMinorUnits)
			}
		})
	}
}
func TestTriggerFreeLifecycle(t *testing.T) {
	g, m := fixture()
	g.Parameters.FreeTrigger = 1
	e := engine(t, g, m)
	paid, err := e.Spin(context.Background(), SpinRequest{BetMinorUnits: 100})
	if err != nil {
		t.Fatal(err)
	}
	if !paid.TriggeredFree || paid.Round.FreeSymbols != 3 || paid.NextState.Free.Remaining != 2 {
		t.Fatalf("bad trigger %+v", paid)
	}
	state := paid.NextState
	original := *state.Free
	first, err := e.Spin(context.Background(), SpinRequest{State: state})
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(*state.Free, original) {
		t.Fatal("input mutated")
	}
	if first.Mode != Free || first.ChargeMinorUnits != 0 || first.WinMinorUnits != 20 || first.NextState.Free.Remaining != 1 || first.TriggeredFree {
		t.Fatalf("bad free %+v", first)
	}
	last, err := e.Spin(context.Background(), SpinRequest{State: first.NextState})
	if err != nil {
		t.Fatal(err)
	}
	if last.NextState.Free != nil || last.NextState.Streak != 1 {
		t.Fatal("free not finished")
	}
}
func TestGuaranteeAndRetrigger(t *testing.T) {
	g, m := fixture()
	g.Parameters.Guaranteed = true
	g.Parameters.FreeWin = 0
	g.Parameters.FreeTrigger = 1
	limit := 1
	g.Parameters.RetriggerLimit = &limit
	e := engine(t, g, m)
	state := State{Version: e.Version(), HasTriggeredFree: true, Free: &FreeSession{Remaining: 1, BetMinorUnits: 100, GuaranteeAt: 1}}
	out, err := e.Spin(context.Background(), SpinRequest{State: state})
	if err != nil {
		t.Fatal(err)
	}
	if out.WinMinorUnits != 20 || !out.TriggeredFree || out.NextState.Free.Remaining != 2 || out.NextState.Free.Retriggers != 1 || out.Round.FreeSymbols != 3 {
		t.Fatalf("bad guarantee %+v", out)
	}
	out, err = e.Spin(context.Background(), SpinRequest{State: out.NextState})
	if err != nil {
		t.Fatal(err)
	}
	if out.WinMinorUnits != 0 || out.TriggeredFree || out.Round.FreeSymbols > 2 {
		t.Fatal("retrigger cap/guarantee failed")
	}
}
func TestErrorsAndCoverage(t *testing.T) {
	g, m := fixture()
	if _, err := NewEngine(g, NewMemoryLibrary(nil), Options{TriggerSymbolCount: 3}); !errors.Is(err, ErrMissingSkeleton) {
		t.Fatal(err)
	}
	e := engine(t, g, m)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := e.Spin(ctx, SpinRequest{BetMinorUnits: 100}); !errors.Is(err, context.Canceled) {
		t.Fatal(err)
	}
	if _, err := e.Spin(context.Background(), SpinRequest{BetMinorUnits: 100, State: State{Version: "old"}}); !errors.Is(err, ErrVersion) {
		t.Fatal(err)
	}
	e.options.Random = func() (float64, error) { return math.NaN(), nil }
	if _, err := e.Spin(context.Background(), SpinRequest{BetMinorUnits: 100}); err == nil {
		t.Fatal("invalid RNG accepted")
	}
}
func TestConcurrentSpins(t *testing.T) {
	g, m := fixture()
	e, err := NewEngine(g, m, Options{TriggerSymbolCount: 3})
	if err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	for i := 0; i < 30; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := e.Spin(context.Background(), SpinRequest{BetMinorUnits: 100})
			if err != nil {
				t.Error(err)
			}
		}()
	}
	wg.Wait()
}
func TestDecodeRejectsWrongPayoutAndFixedScatter(t *testing.T) {
	g, m := fixture()
	e := engine(t, g, m)
	for _, a := range []struct {
		s []int
		k string
	}{{[]int{3, 0, 1, 2, 1, 4, 1, 0}, "3"}, {[]int{1, 0, 11, 0}, "2"}, {[]int{3, 0, 1, 2, 1, 4, 1}, "2"}} {
		if _, err := e.decode(context.Background(), a.s, Base, a.k); err == nil {
			t.Fatal("invalid skeleton accepted", a)
		}
	}
}

func TestLoadExistingGameAndStrictRows(t *testing.T) {
	for _, raw := range []string{"[1]", "[1,2,3]", "null"} {
		var row WeightRow
		if json.Unmarshal([]byte(raw), &row) == nil {
			t.Fatal("malformed weight row accepted", raw)
		}
	}
}

func TestScatterTargetsAndZeroWeight(t *testing.T) {
	for _, target := range []int{3, 4, 5} {
		g, m := fixture()
		g.Parameters.FreeTrigger = 1
		e := engine(t, g, m)
		e.options.TriggerSymbolCount = target
		out, err := e.Spin(context.Background(), SpinRequest{BetMinorUnits: 100})
		if err != nil {
			t.Fatal(target, err)
		}
		if out.Round.FreeSymbols != target {
			t.Fatal("wrong scatter target")
		}
	}
	g, m := fixture()
	g.Board.Symbols[len(g.Board.Symbols)-1].Weight = 0
	e := engine(t, g, m)
	out, err := e.Spin(context.Background(), SpinRequest{BetMinorUnits: 100})
	if err != nil {
		t.Fatal(err)
	}
	if out.Round.FreeSymbols != 0 {
		t.Fatal("zero weight scatter appeared")
	}
	g.Parameters.FreeTrigger = 1
	e = engine(t, g, m)
	if _, err = e.Spin(context.Background(), SpinRequest{BetMinorUnits: 100}); err == nil {
		t.Fatal("trigger accepted without scatter weight")
	}
}
func TestBadLibraryDoesNotFallback(t *testing.T) {
	g, _ := fixture()
	m := NewMemoryLibrary(map[Mode]map[string][][]int{Base: {"2": {{1, 0, 11, 0}}}, Free: {"4": {{3, 0, 1, 2, 1, 4, 1, 0}}}})
	e := engine(t, g, m)
	state := State{Version: e.Version(), Sequence: 3, Streak: -2}
	before := state
	if _, err := e.Spin(context.Background(), SpinRequest{BetMinorUnits: 100, State: state}); err == nil {
		t.Fatal("invalid library accepted")
	}
	if state != before {
		t.Fatal("input state mutated")
	}
}

func TestAwardDeterminesScatterCountForBaseAndRetrigger(t *testing.T) {
	for award, symbols := range map[int]int{8: 3, 10: 4, 12: 5} {
		g, library := fixture()
		g.Parameters.FreeTrigger = 1
		g.Parameters.Awards = [][2]float64{{float64(award), 1}}
		limit := 1
		g.Parameters.RetriggerLimit = &limit
		e, err := NewEngine(g, library, Options{TriggerSymbolCount: 3, FreeAwardSymbolCounts: map[int]int{8: 3, 10: 4, 12: 5}, Random: seeded(42)})
		if err != nil {
			t.Fatal(err)
		}
		base, err := e.Spin(context.Background(), SpinRequest{BetMinorUnits: 100})
		if err != nil {
			t.Fatal(award, err)
		}
		if base.AwardedFreeSpins != award || base.Round.FreeSymbols != symbols || base.NextState.Free.Remaining != award {
			t.Fatalf("base award=%d symbols=%d remaining=%d", base.AwardedFreeSpins, base.Round.FreeSymbols, base.NextState.Free.Remaining)
		}
		free, err := e.Spin(context.Background(), SpinRequest{State: base.NextState})
		if err != nil {
			t.Fatal(award, err)
		}
		if free.AwardedFreeSpins != award || free.Round.FreeSymbols != symbols || free.NextState.Free.Remaining != 2*award-1 {
			t.Fatalf("retrigger award=%d symbols=%d remaining=%d", free.AwardedFreeSpins, free.Round.FreeSymbols, free.NextState.Free.Remaining)
		}
	}
}

func TestAwardMappingIsValidatedCopiedAndVersioned(t *testing.T) {
	g, library := fixture()
	g.Parameters.Awards = [][2]float64{{12, 1}}
	legacy := engine(t, g, library)
	mapping := map[int]int{12: 5}
	mapped, err := NewEngine(g, library, Options{TriggerSymbolCount: 3, FreeAwardSymbolCounts: mapping})
	if err != nil {
		t.Fatal(err)
	}
	if legacy.Version() == mapped.Version() {
		t.Fatal("mapping change must create a new version")
	}
	mapping[12] = 3
	if mapped.options.FreeAwardSymbolCounts[12] != 5 {
		t.Fatal("caller mutated running rules")
	}
	for _, invalid := range []map[int]int{{8: 3}, {12: 6}, {12: 2}} {
		if _, err := NewEngine(g, library, Options{TriggerSymbolCount: 3, FreeAwardSymbolCounts: invalid}); err == nil {
			t.Fatal("invalid mapping accepted", invalid)
		}
	}
}
