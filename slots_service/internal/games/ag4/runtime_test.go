package ag4

import (
	"context"
	"encoding/json"
	"math"
	"math/rand"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	game "aislots/slots_service/internal/domain/game"
)

const release = "../../../testdata/deployments/2026-11-13-ag4-modules/AG4"

func fixture(t *testing.T) (Config, Library, Library) {
	t.Helper()
	c, err := LoadConfig(release)
	if err != nil {
		t.Fatal(err)
	}
	b, bm, err := LoadLibrary(c, "base", filepath.Join(release, "base-library"))
	if err != nil {
		t.Fatal(err)
	}
	f, fm, err := LoadLibrary(c, "free", filepath.Join(release, "free-library"))
	if err != nil {
		t.Fatal(err)
	}
	if bm.Covered != 135 || fm.Covered != 26 || b["0"] != nil || f["0"] != nil {
		t.Fatal("coverage/zero source", bm, fm)
	}
	return c, b, f
}
func runtime(t *testing.T, c Config, b, f Library) *Runtime {
	t.Helper()
	r, err := New(c, b, f, Options{Random: rand.New(rand.NewSource(42)), MaxFillAttempts: 64})
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func TestEveryPositiveBucketAndBonus(t *testing.T) {
	c, b, f := fixture(t)
	r := runtime(t, c, b, f)
	rng := random{r.source}
	for _, key := range r.ordinaryAwards.keys {
		list := b[key]
		seq, err := r.normal(list[0], key, rng)
		if err != nil {
			t.Fatalf("base %s: %v", key, err)
		}
		result, err := r.result(123, outcome{Mode: "base", NextSequence: 1, Sequence: seq, Multiplier: key})
		if err != nil {
			t.Fatal(key, err)
		}
		if err = r.ValidateStoredResult(result); err != nil {
			t.Fatal(key, err)
		}
	}
	for _, key := range r.respinAwards.keys {
		list := f[key]
		seq, _, err := Inspect(c.Rules, list[0], "free")
		if err != nil {
			t.Fatal(err)
		}
		result, err := r.result(123, outcome{Mode: "respin", NextSequence: 1, Sequence: seq, Multiplier: key})
		if err != nil {
			t.Fatal(key, err)
		}
		if err = r.ValidateStoredResult(result); err != nil {
			t.Fatal(key, err)
		}
		for i, p := range result.Frames {
			if i < len(result.Frames)-1 && p.WinMinorUnits != 0 {
				t.Fatal("early respin credit")
			}
		}
	}
	for _, test := range []struct {
		board []int
		bonus int
		raw   string
	}{
		{[]int{1, 1, 1, 1, 1, 1, 1, 1, 1}, 10, "150"},
		{[]int{7, 7, 7, 7, 7, 7, 7, 7, 7}, 10, "12500"},
		{[]int{1, 2, 3, 1, 2, 3, 1, 2, 3}, 1, "16"},
	} {
		_, bonus, raw, err := Evaluate(c.Rules, test.board)
		if err != nil || bonus != test.bonus || raw != test.raw {
			t.Fatal(test, bonus, raw, err)
		}
	}
}

func TestDrawModesZeroAndRecovery(t *testing.T) {
	c, b, f := fixture(t)
	for _, mode := range []string{"base", "respin"} {
		for _, win := range []string{"0", "1"} {
			t.Run(mode+win, func(t *testing.T) {
				cc := c
				cc.Parameters.BaseWin = json.Number(win)
				cc.Parameters.RespinWin = json.Number(win)
				cc.Parameters.Trigger = "0"
				if mode == "respin" {
					cc.Parameters.Trigger = "1"
				}
				r := runtime(t, cc, b, f)
				if win == "0" {
					r.base = nil
					r.respin = nil
				} // zero outcomes must not read any library
				partial := false
				var state game.State
				for i := 0; i < 100; i++ {
					out, err := r.Draw(context.Background(), game.Request{BetMinorUnits: 123, State: state})
					if err != nil {
						t.Fatal(i, err)
					}
					var payload outcome
					if err = json.Unmarshal(out.Payload, &payload); err != nil {
						t.Fatal(err)
					}
					if payload.Mode != mode || (win == "0" && out.WinMinorUnits != 0) || (win == "1" && out.WinMinorUnits == 0) {
						t.Fatal("wrong sampled outcome", out)
					}
					if err = r.ValidateStoredResult(out); err != nil {
						t.Fatal(err)
					}
					if mode == "respin" {
						if len(out.Frames) < 2 {
							t.Fatal("missing respin termination")
						}
						last := payload.Sequence.Boards[len(payload.Sequence.Boards)-1]
						count := 0
						for _, id := range last {
							if id != 0 {
								count++
							}
						}
						partial = partial || (count > 0 && count < 9)
					}
					raw, _ := json.Marshal(out)
					var restored game.Result
					if err = json.Unmarshal(raw, &restored); err != nil {
						t.Fatal(err)
					}
					if err = r.ValidateStoredResult(restored); err != nil {
						t.Fatal(err)
					}
					state = restored.NextState
				}
				if mode == "respin" && win == "0" && !partial {
					t.Fatal("zero respins always empty")
				}
			})
		}
	}
}

func TestStoredDataAndInvalidConfigRejected(t *testing.T) {
	c, b, f := fixture(t)
	r := runtime(t, c, b, f)
	out, err := r.Draw(context.Background(), game.Request{BetMinorUnits: 123})
	if err != nil {
		t.Fatal(err)
	}
	out.Frames[0].Payload = json.RawMessage(`{}`)
	if err = r.ValidateStoredResult(out); err == nil {
		t.Fatal("corrupted display accepted")
	}
	// The single-pass guarantee requires a nonempty weighted candidate pool
	// after excluding at most three ordinary symbols.
	for i := range c.Rules.Symbols {
		if c.Rules.Symbols[i].ID > 3 {
			c.Rules.Symbols[i].Weight = "0"
		}
	}
	if err = c.Validate(); err == nil {
		t.Fatal("insufficient positive ordinary candidates accepted")
	}
	c, b, f = fixture(t)
	delete(b, "3")
	if _, err = New(c, b, f, Options{MaxFillAttempts: 64}); err == nil {
		t.Fatal("missing positive bucket accepted")
	}
	if _, _, err = Inspect(c.Rules, Skeleton{Target: pointer(1), Stages: [][]int{{0, 1}, {0, 1}, {}}}, "free"); err == nil {
		t.Fatal("locked overwrite accepted")
	}
	_ = f
}
func pointer(v int) *int { return &v }

func TestImmutableReleaseHashesAndRevalidation(t *testing.T) {
	c, b, f := fixture(t)
	_ = c
	_ = b
	_ = f
	root := t.TempDir()
	out := filepath.Join(root, "release")
	if err := Publish("../../../../game_configs/AG4", "../../../../game_libraries/AG4/base/2026-11-13T10-26-51-634Z-2195d532", "../../../../game_libraries/AG4/free/2026-11-13T10-00-15-938Z-1a05b394", out); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(out, filepath.Join(out, "base-library"), filepath.Join(out, "free-library"), Options{MaxFillAttempts: 64}); err != nil {
		t.Fatal(err)
	}
	before, _ := os.ReadFile(filepath.Join(out, "free-library", "manifest.json"))
	if err := Publish(out, out, out, out); err == nil {
		t.Fatal("immutable release overwritten")
	}
	after, _ := os.ReadFile(filepath.Join(out, "free-library", "manifest.json"))
	if !reflect.DeepEqual(before, after) {
		t.Fatal("release changed")
	}
	data := filepath.Join(out, "base-library", "library.json")
	if err := os.WriteFile(data, []byte(`{}`), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(out, filepath.Join(out, "base-library"), filepath.Join(out, "free-library"), Options{MaxFillAttempts: 64}); err == nil {
		t.Fatal("damaged library accepted")
	}
}

func TestProbabilityBoundsAndOverflow(t *testing.T) {
	c, b, f := fixture(t)
	c.Feature.FillProbability = "0"
	c.Parameters.Trigger = "1"
	c.Parameters.RespinWin = "0"
	r := runtime(t, c, b, f)
	out, err := r.Draw(context.Background(), game.Request{BetMinorUnits: 50})
	if err != nil || len(out.Frames) != 2 || out.WinMinorUnits != 0 {
		t.Fatal("zero-probability termination", out, err)
	}
	c, b, f = fixture(t)
	c.Feature.FillProbability = "1"
	c.Parameters.RespinWin = "1"
	r = runtime(t, c, b, f)
	if r.Version() == "" {
		t.Fatal("missing immutable version")
	}
	if _, err = payout(math.MaxInt64, "5000"); err == nil {
		t.Fatal("payout overflow accepted")
	}
}
