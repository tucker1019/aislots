package engine

import (
	"crypto/rand"
	"fmt"
	"math"
	"math/big"
)

type random struct {
	source func() (float64, error)
	err    error
}

func (r *random) next() float64 {
	if r.err != nil {
		return 0
	}
	var x float64
	if r.source != nil {
		x, r.err = r.source()
	} else {
		var n *big.Int
		n, r.err = rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 53))
		if r.err == nil {
			x = float64(n.Int64()) / 9007199254740992
		}
	}
	if r.err == nil && (math.IsNaN(x) || math.IsInf(x, 0) || x < 0 || x >= 1) {
		r.err = fmt.Errorf("random draw outside [0,1)")
	}
	return x
}
func (r *random) index(n int) int {
	if n <= 0 {
		r.err = fmt.Errorf("empty weighted choice")
		return 0
	}
	if r.source != nil {
		return int(r.next() * float64(n))
	}
	v, e := rand.Int(rand.Reader, big.NewInt(int64(n)))
	if e != nil {
		r.err = e
		return 0
	}
	return int(v.Int64())
}
func (r *random) weighted(weights []float64) int {
	sum := 0.0
	for _, w := range weights {
		if w < 0 || math.IsNaN(w) || math.IsInf(w, 0) {
			r.err = fmt.Errorf("invalid weight")
			return 0
		}
		sum += w
	}
	if sum <= 0 || math.IsInf(sum, 0) {
		r.err = fmt.Errorf("empty/overflow weight total")
		return 0
	}
	draw := r.next() * sum
	last := 0
	for i, w := range weights {
		if w > 0 {
			last = i
		}
		draw -= w
		if draw < 0 {
			return i
		}
	}
	return last
}
