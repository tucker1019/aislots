package ag8

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

const release = "../../../testdata/deployments/2026-11-15-ag8/AG8"

func components(t *testing.T) (Config, Library, Library) {
	t.Helper()
	c, e := LoadConfig(release)
	if e != nil {
		t.Fatal(e)
	}
	b, _, e := LoadLibrary(c, "base", filepath.Join(release, "base-library"))
	if e != nil {
		t.Fatal(e)
	}
	f, _, e := LoadLibrary(c, "free", filepath.Join(release, "free-library"))
	if e != nil {
		t.Fatal(e)
	}
	return c, b, f
}
func fixed(t *testing.T, feature, hit bool, raw string) (*Runtime, *countReader) {
	t.Helper()
	c, b, f := components(t)
	c.Parameters.Trigger = "0"
	if feature {
		c.Parameters.Trigger = "1"
	}
	p := json.Number("0")
	if hit {
		p = "1"
	}
	c.Parameters.BaseWin, c.Parameters.FreeWin = p, p
	c.Dragon.Boost.BaseWin, c.Dragon.Boost.FreeWin = p, p
	c.Base = []WeightRow{{json.Number(raw), "1"}}
	c.Free = c.Base
	c.Dragon.Boost.Base, c.Dragon.Boost.Free = c.Base, c.Base
	c.Dragon.NormalMultipliers = []WeightRow{{"5", "1"}}
	c.Dragon.FreeMultiplierCounts = []WeightRow{{"3", "1"}}
	c.Dragon.FreeMultipliers = []WeightRow{{"10", "1"}}
	source := &countReader{source: rand.New(rand.NewSource(1048))}
	r, e := New(c, b, f, Options{Random: source})
	if e != nil {
		t.Fatal(e)
	}
	return r, source
}

type countReader struct {
	source io.Reader
	calls  int
}

func (r *countReader) Read(p []byte) (int, error) { r.calls++; return r.source.Read(p) }

type badReader struct{}

func (badReader) Read([]byte) (int, error) { return 0, errors.New("entropy unavailable") }
func draw(t *testing.T, r *Runtime, stake int64, mode int) game.Result {
	t.Helper()
	out, e := r.Draw(context.Background(), game.Request{BetMinorUnits: stake, BuyMode: mode})
	if e != nil {
		t.Fatal(e)
	}
	if e = r.ValidateStoredResult(out); e != nil {
		t.Fatal(e)
	}
	return out
}
func display(t *testing.T, f game.Frame) Display {
	t.Helper()
	var d Display
	if e := strict(f.Payload, &d); e != nil {
		t.Fatal(e)
	}
	return d
}
func TestScreenshotPayoutsAndSinglePassFill(t *testing.T) {
	c, b, f := components(t)
	r, e := New(c, b, f, Options{})
	if e != nil {
		t.Fatal(e)
	}
	for _, tc := range []struct {
		board []int
		raw   int64
	}{{[]int{0, 1, 0, 0, 7, 0, 0, 1, 0}, 2}, {[]int{7, 7, 7, 7, 7, 7, 7, 7, 7}, 500}, {[]int{6, 6, 6, 6, 6, 6, 6, 6, 6}, 250}} {
		got, e := Evaluate(c.Rules, tc.board, "base")
		if e != nil || got.RawPayout != tc.raw {
			t.Fatal(got, e)
		}
	}
	source := &countReader{source: rand.New(rand.NewSource(3))}
	rng := random{source}
	for _, mode := range []string{"base", "free"} {
		board, e := r.loss(mode, rng)
		if e != nil {
			t.Fatal(e)
		}
		evaluation, _ := Evaluate(c.Rules, board, mode)
		if evaluation.RawPayout != 0 {
			t.Fatal("loss paid")
		}
		lib := b
		if mode == "free" {
			lib = f
		}
		for key, list := range lib {
			for _, s := range list {
				for n := 0; n < 3; n++ {
					before, award, e := Inspect(c.Rules, s, mode)
					if e != nil {
						t.Fatal(e)
					}
					full, e := r.fill(s, mode, rng)
					if e != nil {
						t.Fatal(e)
					}
					actual, _ := Evaluate(c.Rules, full, mode)
					if !reflect.DeepEqual(award, actual) || key != strconv.FormatInt(actual.RawPayout, 10) {
						t.Fatal("changed award")
					}
					for p, id := range before {
						if id > 0 && full[p] != id {
							t.Fatal("changed fixed cell")
						}
					}
				}
			}
		}
	}
	if _, _, e := Inspect(c.Rules, Skeleton{Cells: []int{0, 7, 4, 7}}, "base"); e == nil {
		t.Fatal("unfillable double Wild accepted")
	}
}
func TestEightLossesStayFreeAndModesUseDifferentDivisors(t *testing.T) {
	r, source := fixed(t, true, false, "2")
	out := draw(t, r, 103, 1)
	if len(out.Frames) != 8 || out.WinMinorUnits != 0 {
		t.Fatal("eight losses collapsed")
	}
	calls := source.calls
	for i, f := range out.Frames {
		d := display(t, f)
		if d.Mode != "free" || d.FreeRemaining != 7-i || d.GameData.MultiplierSum != 30 || d.SpinWinAmount != 0 || d.GameData.StageTotal != 8 {
			t.Fatal(d)
		}
		if (i == 0) != d.TriggeredFree {
			t.Fatal("trigger flag")
		}
		if e := r.ValidateStoredResult(out); e != nil {
			t.Fatal(e)
		}
	}
	if source.calls != calls {
		t.Fatal("validation sampled")
	}
	for _, mode := range []int{1, 2} {
		r, _ := fixed(t, false, true, "2")
		out := draw(t, r, 100, mode)
		want := int64(200)
		if mode == 2 {
			want = 40
		}
		if out.WinMinorUnits != want {
			t.Fatal(mode, out.WinMinorUnits, want)
		}
		d := display(t, out.Frames[0])
		if d.BuyMode != mode || d.GameData.MultiplierSum != 5 || d.FreeRemaining != 0 {
			t.Fatal(d)
		}
	}
}
func TestFreeCapTruncatesLastAwardAndStopsRemainingSpins(t *testing.T) {
	for _, mode := range []int{1, 2} {
		r, _ := fixed(t, true, true, "500")
		out := draw(t, r, 103, mode)
		wantFrames := 1
		if mode == 2 {
			wantFrames = 5
		}
		if len(out.Frames) != wantFrames || out.WinMinorUnits != 103*2500 {
			t.Fatal(mode, len(out.Frames), out.WinMinorUnits)
		}
		last := display(t, out.Frames[len(out.Frames)-1])
		if !last.GameData.CapReached || last.FreeRemaining != 0 || last.GameData.RawWin != 15000 {
			t.Fatal(last)
		}
		if mode == 2 && last.GameData.PaidRawWin != 2500 {
			t.Fatal("cap not truncated")
		}
		checkCredits(t, out)
	}
}
func checkCredits(t *testing.T, out game.Result) {
	t.Helper()
	var sum int64
	for _, f := range out.Frames {
		d := display(t, f)
		var lines int64
		for _, item := range d.GameData.Replay.Payouts {
			n, e := strconv.ParseInt(item.Amount, 10, 64)
			if e != nil || n < 0 {
				t.Fatal(item, e)
			}
			lines += n
		}
		if lines != f.WinMinorUnits || lines != d.SpinWinAmount {
			t.Fatal("line/frame credit mismatch", lines, f.WinMinorUnits)
		}
		sum += lines
	}
	if sum != out.WinMinorUnits {
		t.Fatal("round credit mismatch")
	}
}
func TestCumulativeRoundingAndPersistedTampering(t *testing.T) {
	r, _ := fixed(t, true, true, "3")
	out := draw(t, r, 1, 2)
	if len(out.Frames) != 8 || out.WinMinorUnits != 28 {
		t.Fatal(out.WinMinorUnits)
	}
	checkCredits(t, out)
	edits := []func(*game.Result){func(v *game.Result) { v.WinMinorUnits++ }, func(v *game.Result) { v.NextState.Pending = true }, func(v *game.Result) {
		var o outcome
		_ = json.Unmarshal(v.Payload, &o)
		o.Stages = o.Stages[:7]
		v.Payload, _ = json.Marshal(o)
	}, func(v *game.Result) {
		var o outcome
		_ = json.Unmarshal(v.Payload, &o)
		o.Stages[0].Multipliers[0] = 2
		v.Payload, _ = json.Marshal(o)
	}, func(v *game.Result) {
		var d Display
		_ = json.Unmarshal(v.Frames[0].Payload, &d)
		d.GameData.MultiplierSum++
		v.Frames[0].Payload, _ = json.Marshal(d)
	}}
	for i, edit := range edits {
		raw, _ := json.Marshal(out)
		var v game.Result
		_ = json.Unmarshal(raw, &v)
		edit(&v)
		if e := r.ValidateStoredResult(v); e == nil {
			t.Fatal("tampering accepted", i)
		}
	}
}
func TestErrorsSnapshotsAndReleaseCoverage(t *testing.T) {
	c, b, f := components(t)
	r, e := New(c, b, f, Options{Random: badReader{}})
	if e != nil {
		t.Fatal(e)
	}
	if _, e = r.Draw(context.Background(), game.Request{BetMinorUnits: 100}); e == nil {
		t.Fatal("entropy failure hidden")
	}
	for _, req := range []game.Request{{BetMinorUnits: 0}, {BetMinorUnits: math.MaxInt64}, {BetMinorUnits: 100, BuyMode: 3}} {
		if _, e = r.Draw(context.Background(), req); e == nil {
			t.Fatal("invalid request accepted")
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, e = r.Draw(ctx, game.Request{BetMinorUnits: 100}); !errors.Is(e, context.Canceled) {
		t.Fatal(e)
	}
	raw, e := os.ReadFile(filepath.Join(release, "base-library/library.json"))
	if e != nil {
		t.Fatal(e)
	}
	var corrupt Library
	_ = json.Unmarshal(raw, &corrupt)
	delete(corrupt, "2")
	raw, _ = json.Marshal(corrupt)
	if _, _, _, e = ValidateLibrary(c, "base", raw); e == nil {
		t.Fatal("missing coverage accepted")
	}
	dir := filepath.Join(t.TempDir(), "AG8")
	if e = Publish(release, "../../../../game_libraries/AG8/base/2026-11-14T20-16-18-805Z-5091957b", "../../../../game_libraries/AG8/free/2026-11-14T20-21-26-779Z-24215157", dir); e != nil {
		t.Fatal(e)
	}
	if _, e = Load(dir, filepath.Join(dir, "base-library"), filepath.Join(dir, "free-library"), Options{}); e != nil {
		t.Fatal(e)
	}
}
func TestConcurrentDrawsAndClosedStateAcrossReleases(t *testing.T) {
	c, b, f := components(t)
	r, e := New(c, b, f, Options{Random: rand.New(rand.NewSource(1048))})
	if e != nil {
		t.Fatal(e)
	}
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 10; j++ {
				out, e := r.Draw(context.Background(), game.Request{BetMinorUnits: 103, BuyMode: 2})
				if e == nil {
					e = r.ValidateStoredResult(out)
				}
				if e != nil {
					t.Error(e)
					return
				}
			}
		}()
	}
	wg.Wait()
	out := draw(t, r, 100, 1)
	c.Parameters.Trigger = "0"
	next, e := New(c, b, f, Options{})
	if e != nil {
		t.Fatal(e)
	}
	if _, e = next.Draw(context.Background(), game.Request{BetMinorUnits: 100, State: out.NextState}); e != nil {
		t.Fatal(e)
	}
}
