package server

import (
	"apps/app/apis/lobby/api/internal/config"
	"testing"
)

func TestNearestExperienceBet(t *testing.T) {
	for _, c := range []struct {
		target int64
		bet    int64
		level  int
	}{{500, 10, 2}, {300, 10, 1}, {999, 50, 1}} {
		b, l := nearestExperienceBet([]int64{10, 50}, 20, 2, c.target)
		if b != c.bet || l != c.level {
			t.Fatalf("target %d: %d/%d", c.target, b, l)
		}
	}
	for i := 0; i < 1000; i++ {
		n := secureRange(1, 100)
		if n < 1 || n > 100 {
			t.Fatal(n)
		}
	}
}

func TestExperienceGameSelectionAndStopPolicy(t *testing.T) {
	cfg := config.ExperienceConfig{GameWeights: map[string]int64{"AG1": 3, "AG2": 1, "CLOSED": 100, "ZERO": 0}}
	games := map[string]config.GameEntry{"AG1": {Enabled: true, APIURL: "http://one/"}, "AG2": {Enabled: true, APIURL: "http://two/"}, "CLOSED": {APIURL: "http://closed/"}, "ZERO": {Enabled: true, APIURL: "http://zero/"}}
	for _, tc := range []struct {
		draw int64
		want string
	}{{0, "AG1"}, {2, "AG1"}, {3, "AG2"}} {
		got, err := selectExperienceGame(cfg, games, func(total int64) (int64, error) {
			if total != 4 {
				t.Fatal(total)
			}
			return tc.draw, nil
		})
		if err != nil || got != tc.want {
			t.Fatal(got, err)
		}
	}
	for _, tc := range []struct {
		rounds, every, chance, draw int
		want                        bool
	}{{49, 50, 20, 1, false}, {50, 50, 20, 20, true}, {50, 50, 20, 21, false}, {100, 50, 0, 1, false}, {7, 7, 100, 100, true}} {
		if got := experienceShouldStop(tc.rounds, tc.every, tc.chance, func() int { return tc.draw }); got != tc.want {
			t.Fatal(tc, got)
		}
	}
}

func TestExperienceFundingUsesConfiguredRangeAndLegalStake(t *testing.T) {
	min, max, step := int64(5000000), int64(10000000), int64(1000000)
	low, high := 20, 50
	cfg := config.ExperienceConfig{InitialCoinsMin: &min, InitialCoinsMax: &max, InitialCoinsStep: &step, BetDivisorMin: &low, BetDivisorMax: &high}
	policy := experiencePolicy{Amounts: []int64{1000, 5000}, LineCount: 20, BetLevel: 10}
	for _, upper := range []bool{false, true} {
		calls := 0
		initial, bet, level := experienceFunding(cfg, policy, func(a, b int) int {
			calls++
			if upper {
				return b
			}
			return a
		})
		expected, divisor := min, low
		if upper {
			expected, divisor = max, high
		}
		wantBet, wantLevel := nearestExperienceBet(policy.Amounts, policy.LineCount, policy.BetLevel, expected/int64(divisor))
		if initial != expected || bet != wantBet || level != wantLevel || calls != 2 {
			t.Fatalf("unexpected funding: %d %d %d calls=%d", initial, bet, level, calls)
		}
	}
}
