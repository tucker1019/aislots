package engine

import (
	"encoding/json"
	"math"
	"os"
	"testing"
)

func TestTSProbabilityParity(t *testing.T) {
	raw, err := os.ReadFile("testdata/ts-probability.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases []struct {
		Parameters Parameters
		Base, Free []WeightRow
		Spins      float64
		BaseChecks []struct {
			Streak            int64
			Probability, Mean float64
		}
		FreeChecks []struct {
			Misses                     int
			Trigger, Probability, Mean float64
		}
	}
	if err = json.Unmarshal(raw, &cases); err != nil {
		t.Fatal(err)
	}
	close := func(a, b float64) {
		t.Helper()
		if math.Abs(a-b) > 1e-11*math.Max(1, math.Abs(b)) {
			t.Fatalf("Go=%g TS=%g", a, b)
		}
	}
	for _, c := range cases {
		e := &Engine{game: Game{Parameters: c.Parameters}}
		e.base, err = parseTable(c.Base)
		if err != nil {
			t.Fatal(err)
		}
		e.free, err = parseTable(c.Free)
		if err != nil {
			t.Fatal(err)
		}
		e.freeSpinsMean, err = e.sessionSpins()
		if err != nil {
			t.Fatal(err)
		}
		close(e.freeSpinsMean, c.Spins)
		for _, b := range c.BaseChecks {
			close(e.baseProbability(b.Streak), b.Probability)
			weights, err := e.baseWeights(b.Streak)
			if err != nil {
				t.Fatal(err)
			}
			sum, mean := 0.0, 0.0
			for i, w := range weights {
				sum += w
				mean += w * e.base.rows[i].value / float64(c.Parameters.LineCount)
			}
			close(mean/sum, b.Mean)
		}
		for _, f := range c.FreeChecks {
			trigger := e.triggerProbability(f.Misses)
			close(trigger, f.Trigger)
			p, err := e.freeProbability(trigger)
			if err != nil {
				t.Fatal(err)
			}
			close(p, f.Probability)
			close(e.sessionMean(p), f.Mean)
		}
	}
}
