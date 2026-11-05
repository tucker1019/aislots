package server

import "testing"

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
