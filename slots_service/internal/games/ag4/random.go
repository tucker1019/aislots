package ag4

import (
	"crypto/rand"
	"fmt"
	"io"
	"math/big"
	"sync"

	"aislots/slots_service/internal/rules/paylines"
)

type lockedReader struct {
	mu     sync.Mutex
	source io.Reader
}

func (r *lockedReader) Read(p []byte) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.source.Read(p)
}

type random struct{ source io.Reader }

func (r random) index(n int) (int, error) {
	v, err := rand.Int(r.source, big.NewInt(int64(n)))
	if err != nil {
		return 0, err
	}
	return int(v.Int64()), nil
}
func (r random) chance(value string) (bool, error) {
	p, err := paylines.Rat(value)
	if err != nil {
		return false, err
	}
	v, err := rand.Int(r.source, p.Denom())
	return err == nil && v.Cmp(p.Num()) < 0, err
}

type weighted struct {
	keys    []string
	weights []*big.Int
	total   *big.Int
}

func newWeighted(keys, values []string) (weighted, error) {
	out := weighted{total: new(big.Int)}
	denominator := big.NewInt(1)
	rats := make([]*big.Rat, len(values))
	if len(keys) != len(values) {
		return out, fmt.Errorf("weight/key mismatch")
	}
	for i, v := range values {
		r, err := paylines.Rat(v)
		if err != nil {
			return out, err
		}
		rats[i] = r
		g := new(big.Int).GCD(nil, nil, denominator, r.Denom())
		denominator.Mul(new(big.Int).Quo(denominator, g), r.Denom())
	}
	for i, r := range rats {
		if r.Sign() == 0 {
			continue
		}
		n := new(big.Int).Mul(r.Num(), new(big.Int).Quo(new(big.Int).Set(denominator), r.Denom()))
		out.keys = append(out.keys, keys[i])
		out.weights = append(out.weights, n)
		out.total.Add(out.total, n)
	}
	if out.total.Sign() == 0 {
		return out, fmt.Errorf("empty positive weights")
	}
	return out, nil
}
func (w weighted) pick(r random) (string, error) {
	n, err := rand.Int(r.source, w.total)
	if err != nil {
		return "", err
	}
	for i, weight := range w.weights {
		if n.Cmp(weight) < 0 {
			return w.keys[i], nil
		}
		n.Sub(n, weight)
	}
	return "", fmt.Errorf("weight sampling failed")
}
