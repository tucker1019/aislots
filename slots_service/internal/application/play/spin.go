package play

import (
	"context"
	"crypto/rand"
	"time"
)

// Status restores the last committed display frame alongside the next request token.
func (s *Service) Status(ctx context.Context, session Session, gameID string) (Status, error) {
	if gameID != session.GameID {
		return Status{}, ErrUnauthorized
	}
	var out Status
	err := s.store.WithPlayer(ctx, session.Player, func(tx Tx) error {
		token, err := tx.SpinToken(ctx, gameID)
		if err != nil {
			return err
		}
		out = Status{RequestID: token, Balance: money(tx.Balance())}
		t, ok, err := tx.FindOpen(ctx)
		if err != nil {
			return err
		}
		if ok {
			if t.Player != session.Player || t.GameID != gameID {
				return ErrConflict
			}
			out.HasNext = t.Status == "active"
			if out.HasNext {
				out.BetAmount = money(t.Amount)
			}
		}
		receipt, found, err := tx.LastSpinReceipt(ctx, gameID, token)
		if err != nil {
			return err
		}
		if out.HasNext && (!found || receipt.Frame.BetID != t.ID) {
			// Older bets created by the legacy API still have persisted settled frames.
			receipt.Frame, found, err = tx.Frame(ctx, t.ID, t.SpinIndex, t.StepIndex)
			if err != nil {
				return err
			}
		}
		if found {
			frame := receipt.Frame
			frame.Balance = out.Balance
			frame.Next = nil
			frame.NextRequestID = token
			out.LastFrame = &frame
		}
		return nil
	})
	return out, err
}

// Spin settles the next unconsumed round. Animation state is never an input.
// Reusing a request token returns its exact committed receipt, including after restart.
func (s *Service) Spin(ctx context.Context, session Session, gameID, requestID string, amount int64) (Frame, error) {
	if gameID != session.GameID {
		return Frame{}, ErrUnauthorized
	}
	if requestID == "" || len(requestID) > 128 || amount < 0 {
		return Frame{}, ErrInvalid
	}
	var out Frame
	err := s.store.WithPlayer(ctx, session.Player, func(tx Tx) error {
		receipt, found, err := tx.SpinReceipt(ctx, gameID, requestID)
		if err != nil {
			return err
		}
		if found {
			if receipt.Amount != amount {
				return ErrConflict
			}
			out = receipt.Frame
			return nil
		}
		token, err := tx.SpinToken(ctx, gameID)
		if err != nil {
			return err
		}
		if token != requestID {
			return ErrConflict
		}
		t, ok, err := tx.FindOpen(ctx)
		if err != nil {
			return err
		}
		if ok && (t.Player != session.Player || t.GameID != gameID) {
			return ErrConflict
		}
		cursor := Cursor{0, 1}
		initial := true
		if ok && t.Status == "active" {
			if amount != t.Amount {
				return ErrConflict
			}
			prior, found, err := tx.Frame(ctx, t.ID, t.SpinIndex, t.StepIndex)
			if err != nil {
				return err
			}
			if !found || prior.Next == nil {
				return ErrConflict
			}
			cursor = *prior.Next
			initial = false
		} else {
			if amount <= 0 {
				return ErrInvalid
			}
			if err := s.bets.AllowedTotal(ctx, session.Player, gameID, amount); err != nil {
				return err
			}
			// Reuse a still-valid legacy preparation; no prepare call is needed by new clients.
			if !ok || t.Amount != amount || time.Now().After(t.ExpiresAt) {
				prepared, err := s.prepareTx(ctx, tx, session, gameID, amount)
				if err != nil {
					return err
				}
				t, err = tx.Ticket(ctx, prepared.BetID)
				if err != nil {
					return err
				}
			}
		}
		frame, err := s.advanceTx(ctx, tx, session, gameID, t.ID, cursor, initial)
		if err != nil {
			return err
		}
		frame.Next = nil // Cursors remain private; clients only decide when to request another round.
		frame.RequestID = requestID
		frame.NextRequestID = rand.Text()
		if err := tx.SaveSpinReceipt(ctx, gameID, requestID, SpinReceipt{Amount: amount, Frame: frame}, frame.NextRequestID); err != nil {
			return err
		}
		out = frame
		return nil
	})
	return out, err
}
