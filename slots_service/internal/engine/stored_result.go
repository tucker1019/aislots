package engine

import (
	"fmt"
	"math/big"
)

// ValidateStoredResult verifies a saved Ways outcome against this immutable
// engine version without drawing randomness or reading a skeleton again.
func (e *Engine) ValidateStoredResult(result SpinResult) error {
	if result.GameID != e.game.ID || result.Version != e.version || result.NextState.Version != e.version || (result.Mode != Base && result.Mode != Free) || result.BetMinorUnits <= 0 {
		return fmt.Errorf("invalid stored Ways identity/mode")
	}
	if _, err := e.evaluate(result.Round.Initial, result.Mode, 0); err != nil {
		return err
	}
	if err := e.validateRound(result.Round, result.Mode); err != nil {
		return err
	}
	raw, ok := new(big.Rat).SetString(result.Round.RawMultiplier)
	if !ok || raw.Sign() < 0 {
		return fmt.Errorf("invalid stored multiplier")
	}
	exact := new(big.Rat).Mul(raw, big.NewRat(result.BetMinorUnits, int64(e.game.Parameters.LineCount)))
	saved, ok := new(big.Rat).SetString(result.ExactWinMinorUnits)
	if !ok || exact.Cmp(saved) != 0 {
		return fmt.Errorf("invalid stored exact payout")
	}
	minor := new(big.Int).Quo(exact.Num(), exact.Denom())
	if !minor.IsInt64() || minor.Int64() != result.WinMinorUnits {
		return fmt.Errorf("invalid stored payout")
	}
	return nil
}
