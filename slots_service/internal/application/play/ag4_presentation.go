package play

import (
	runtime "aislots/slots_service/internal/domain/game"
	"context"
	"encoding/json"
)

// AG4Presentation reads the already-drawn plan for the original AG4 renderer.
// It never draws, settles, or issues a spin token. Balance is intentionally omitted.
func (s *Service) AG4Presentation(ctx context.Context, session Session, betID string) ([]Frame, error) {
	if session.GameID != "AG4" {
		return nil, ErrUnauthorized
	}
	if betID == "" || len(betID) > 128 {
		return nil, ErrInvalid
	}
	var out []Frame
	err := s.store.WithPlayer(ctx, session.Player, func(tx Tx) error {
		t, err := tx.Ticket(ctx, betID)
		if err != nil {
			return err
		}
		if t.Player != session.Player || t.GameID != session.GameID || (t.Status != "active" && t.Status != "complete") {
			return ErrNotFound
		}
		spin, found, err := tx.Spin(ctx, betID, 0)
		if err != nil {
			return err
		}
		if !found {
			return ErrNotFound
		}
		result := spin.Result
		module, err := s.games.Resolve(t.GameID, t.Version)
		if err != nil {
			return err
		}
		if result.GameID != t.GameID || result.Version != t.Version || result.BetMinorUnits != t.Amount {
			return ErrConflict
		}
		if err := module.ValidateStoredResult(result); err != nil {
			return err
		}
		out = make([]Frame, 0, len(result.Frames))
		var total int64
		for i, step := range result.Frames {
			var frame Frame
			raw, err := module.Present(result, runtime.FrameContext{RoundID: betID, FrameIndex: i})
			if err != nil {
				return err
			}
			if err := json.Unmarshal(raw, &frame); err != nil {
				return err
			}
			total += step.WinMinorUnits
			frame.BetID, frame.StepIndex, frame.BetAmount = betID, i+1, t.Amount
			frame.NextAction, frame.WinAmount, frame.TotalWinAmount = step.NextAction, step.WinMinorUnits, total
			out = append(out, frame)
		}
		return nil
	})
	return out, err
}
