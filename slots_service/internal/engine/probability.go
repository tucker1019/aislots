package engine

import (
	"fmt"
	"math"
)

func clamp(n float64) float64 { return math.Max(0, math.Min(1, n)) }
func (e *Engine) baseProbability(streak int64) float64 {
	p := e.game.Parameters
	rule := p.WinRule
	count := streak
	direction := -1.0
	if streak < 0 {
		rule = p.LossRule
		count = -streak
		direction = 1
	}
	if rule == nil || !rule.Enabled || count < int64(rule.Start) {
		return p.BaseWin
	}
	if count > int64(rule.Cap) {
		count = int64(rule.Cap)
	}
	return clamp(rule.Probability + direction*float64((int(count)-rule.Start)/rule.Interval)*rule.Step)
}
func (e *Engine) triggerProbability(misses int) float64 {
	p := e.game.Parameters
	r := p.TriggerRule
	if r == nil || !r.Enabled || misses < r.Start {
		return p.FreeTrigger
	}
	n := min(misses, r.Cap)
	return clamp(math.Min(1, p.FreeTrigger+r.Step) + float64((n-r.Start)/r.Interval)*r.Step)
}

func (e *Engine) baseWeights(streak int64) ([]float64, error) {
	weights := make([]float64, len(e.base.rows))
	p := e.game.Parameters
	prob := e.baseProbability(streak)
	for i, row := range e.base.rows {
		weights[i] = row.weight
	}
	if !p.LossCompensation || streak >= 0 || prob <= p.BaseWin || e.base.mean <= 0 {
		return weights, nil
	}
	firstW, otherW, firstSum, otherSum := 0.0, 0.0, 0.0, 0.0
	for _, row := range e.base.rows {
		actual := row.value / float64(p.LineCount)
		if actual < 1 {
			firstW += row.weight
			firstSum += actual * row.weight
		} else {
			otherW += row.weight
			otherSum += actual * row.weight
		}
	}
	if firstW <= 0 {
		return nil, fmt.Errorf("loss RTP compensation needs first interval weights")
	}
	firstMean := firstSum / firstW
	target := p.BaseWin * (e.base.mean / float64(p.LineCount)) / prob
	if target < firstMean-1e-12 || (otherW == 0 && math.Abs(target-firstMean) > 1e-12) {
		return nil, fmt.Errorf("loss RTP compensation infeasible")
	}
	firstProbability := 1.0
	if otherW > 0 {
		otherMean := otherSum / otherW
		firstProbability = math.Max(firstW/e.base.weight, math.Min(1, (otherMean-target)/(otherMean-firstMean)))
	}
	for i, row := range e.base.rows {
		if row.value/float64(p.LineCount) < 1 {
			weights[i] = firstProbability * row.weight / firstW
		} else {
			weights[i] = (1 - firstProbability) * row.weight / otherW
		}
	}
	return weights, nil
}
func (e *Engine) sessionSpins() (float64, error) {
	p := e.game.Parameters
	total, mean, maxN := 0.0, 0.0, 0
	for _, a := range p.Awards {
		total += a[1]
		mean += a[0] * a[1]
		if a[1] > 0 {
			maxN = max(maxN, int(a[0]))
		}
	}
	mean /= total
	if p.RetriggerLimit == nil {
		if mean*p.FreeTrigger >= 1 {
			return 0, fmt.Errorf("unbounded free session expectation")
		}
		return mean / (1 - mean*p.FreeTrigger), nil
	}
	cap := *p.RetriggerLimit
	if cap == 0 || p.FreeTrigger == 0 {
		return mean, nil
	}
	active := 0
	for _, a := range p.Awards {
		if a[1] > 0 {
			active++
		}
	}
	if int64(maxN)*int64(cap+1)*int64(cap+2)/2*int64(active) > 10_000_000 {
		return 0, fmt.Errorf("free session DP budget too large")
	}
	means := make([]float64, maxN*(cap+1)+1)
	for r := range means {
		means[r] = float64(r)
	}
	for budget := 1; budget <= cap; budget++ {
		next := make([]float64, maxN*(cap-budget+1)+1)
		for r := 1; r < len(next); r++ {
			following := (1 - p.FreeTrigger) * next[r-1]
			for _, a := range p.Awards {
				if a[1] > 0 {
					following += p.FreeTrigger * a[1] / total * means[r-1+int(a[0])]
				}
			}
			next[r] = 1 + following
		}
		means = next
	}
	expected := 0.0
	for _, a := range p.Awards {
		if a[1] > 0 {
			expected += a[1] / total * means[int(a[0])]
		}
	}
	return expected, nil
}
func (e *Engine) sessionMean(f float64) float64 {
	p := e.game.Parameters
	expected := e.freeSpinsMean * f * e.free.mean / float64(p.LineCount)
	if !p.Guaranteed {
		return expected
	}
	hit := f * e.free.positive
	probability, total := 0.0, 0.0
	for _, a := range p.Awards {
		total += a[1]
		prefix := 1.0
		if hit == 1 {
			prefix = 0
		} else if hit > 0 {
			prefix = (1 - hit) * -math.Expm1(a[0]*math.Log1p(-hit)) / (a[0] * hit)
		}
		probability += a[1] * prefix
	}
	return expected + probability/total*e.free.mean/e.free.positive/float64(p.LineCount)
}
func (e *Engine) freeProbability(trigger float64) (float64, error) {
	p := e.game.Parameters
	if !p.FreeCompensation || p.TriggerRule == nil || !p.TriggerRule.Enabled || trigger == p.FreeTrigger {
		return p.FreeWin, nil
	}
	baseline := e.sessionMean(p.FreeWin)
	desired := 0.0
	if trigger > 0 {
		desired = p.FreeTrigger * baseline / trigger
	}
	minimum := e.sessionMean(0)
	if desired < minimum-1e-11*math.Max(1, minimum) || desired > baseline+1e-10 {
		return 0, fmt.Errorf("free RTP compensation infeasible")
	}
	if math.Abs(desired-minimum) < 1e-12 {
		return 0, nil
	}
	low, high := 0.0, p.FreeWin
	for i := 0; i < 60; i++ {
		mid := (low + high) / 2
		if e.sessionMean(mid) < desired {
			low = mid
		} else {
			high = mid
		}
	}
	return (low + high) / 2, nil
}
func (e *Engine) award(r *random) int {
	weights := []float64{}
	for _, a := range e.game.Parameters.Awards {
		weights = append(weights, a[1])
	}
	return int(e.game.Parameters.Awards[r.weighted(weights)][0])
}
