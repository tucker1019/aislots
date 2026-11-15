package ag9

import (
	"aislots/slots_service/internal/rules/paylines"
	"math/big"
)

func Evaluate(config paylines.Config, board []int) (paylines.Result, int, string, error) {
	result, err := paylines.Evaluate(config, board)
	if err != nil {
		return result, 0, "", err
	}
	bonus := 1
	full := len(result.WinningCellIDs) == len(board)
	raw, _ := paylines.Rat(result.RawPayout)
	if full && raw.Sign() > 0 {
		bonus = 10
	}
	raw.Mul(raw, big.NewRat(int64(bonus), 1))
	return result, bonus, raw.RatString(), nil
}
