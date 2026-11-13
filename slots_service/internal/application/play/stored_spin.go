package play

import (
	"encoding/json"
	"fmt"

	"aislots/slots_service/internal/games"
)

// Old game_spins rows stored a Ways result and a separate credit slice. Decode
// them once into a module plan; never generate a replacement outcome.
func (s *StoredSpin) UnmarshalJSON(raw []byte) error {
	var old struct {
		Result      json.RawMessage
		StepAmounts []int64
	}
	if err := json.Unmarshal(raw, &old); err != nil {
		return err
	}
	result, err := games.DecodeResult(old.Result)
	if err != nil {
		return err
	}
	if old.StepAmounts != nil {
		if len(old.StepAmounts) != len(result.Frames)-1 {
			return fmt.Errorf("legacy credits/frame count mismatch")
		}
		for i, a := range old.StepAmounts {
			if a != result.Frames[i].WinMinorUnits {
				return fmt.Errorf("legacy credits/plan mismatch")
			}
		}
	}
	s.Result = result
	return nil
}
