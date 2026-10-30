package engine

import (
	"fmt"
	"math/big"
	"strings"
)

func rational(s string) (*big.Rat, error) {
	r, ok := new(big.Rat).SetString(s)
	if !ok || r.Sign() < 0 {
		return nil, fmt.Errorf("invalid nonnegative decimal %q", s)
	}
	return r, nil
}
func mustRat(s string) *big.Rat { r, _ := rational(s); return r }
func decimal(r *big.Rat) string {
	d := new(big.Int).Set(r.Denom())
	two, five := 0, 0
	for _, entry := range []struct {
		n int64
		p *int
	}{{2, &two}, {5, &five}} {
		for {
			q, m := new(big.Int), new(big.Int)
			q.QuoRem(d, big.NewInt(entry.n), m)
			if m.Sign() != 0 {
				break
			}
			d = q
			*entry.p++
		}
	}
	if d.Cmp(big.NewInt(1)) != 0 {
		return r.RatString()
	}
	places := two
	if five > places {
		places = five
	}
	s := r.FloatString(places)
	if strings.Contains(s, ".") {
		s = strings.TrimRight(strings.TrimRight(s, "0"), ".")
	}
	return s
}
func addRaw(wins []Win) *big.Rat {
	sum := new(big.Rat)
	for _, w := range wins {
		sum.Add(sum, mustRat(w.RawPayout))
	}
	return sum
}

// ValidMultiplierKey reports whether a library bucket is a canonical positive raw multiplier.
func ValidMultiplierKey(key string) bool {
	r, err := rational(key)
	return err == nil && r.Sign() > 0 && decimal(r) == key
}
