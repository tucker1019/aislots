package play

import (
	"crypto/sha256"
	"fmt"
)

// bottomSymbols contains exactly one visual-only bottom cell per reel, using
// canonical symbol IDs. A spin keeps these cells through all cascade steps.
// The frame stores them for state recovery and replay; they are not engine cells.
func bottomSymbols(gameID, betID string, spin int, free bool) []int {
	if gameID != "AG1" && gameID != "AG2" && gameID != "AG3" {
		return nil
	}
	columns, symbols := 5, 9
	if gameID == "AG3" {
		columns, symbols = 6, 8
	}
	result := make([]int, columns)
	for c := range result {
		digest := sha256.Sum256([]byte(fmt.Sprintf("bottom:v1:%s:%s:%d:%d", gameID, betID, spin, c)))
		symbol := int(digest[0])%symbols + 1
		if free && c == 2 && gameID != "AG3" {
			symbol += 1000
		}
		result[c] = symbol
	}
	return result
}
