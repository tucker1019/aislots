package legacyways

import (
	"aislots/slots_service/internal/engine"
	"fmt"
	"math/big"
)

// splitAwards floors cumulative exact amounts so stage credits sum to the total.
func SplitAwards(result engine.SpinResult) ([]int64, error) {
	total, ok := new(big.Rat).SetString(result.Round.RawMultiplier)
	if !ok || total.Sign() < 0 {
		return nil, fmt.Errorf("invalid raw multiplier")
	}
	exact, ok := new(big.Rat).SetString(result.ExactWinMinorUnits)
	if !ok || exact.Sign() < 0 {
		return nil, fmt.Errorf("invalid exact payout")
	}
	awards := []int64{}
	sum := new(big.Rat)
	previous := int64(0)
	for _, step := range result.Round.Steps {
		raw, ok := new(big.Rat).SetString(step.RawPayout)
		if !ok || raw.Sign() < 0 || total.Sign() == 0 {
			return nil, fmt.Errorf("invalid step payout")
		}
		sum.Add(sum, raw)
		cumulative := new(big.Rat).Mul(sum, new(big.Rat).Quo(exact, total))
		minor := new(big.Int).Quo(cumulative.Num(), cumulative.Denom())
		if !minor.IsInt64() || minor.Int64() < previous {
			return nil, fmt.Errorf("step payout overflow")
		}
		awards = append(awards, minor.Int64()-previous)
		previous = minor.Int64()
	}
	if sum.Cmp(total) != 0 || previous != result.WinMinorUnits {
		return nil, fmt.Errorf("step and total payouts differ")
	}
	return awards, nil
}
