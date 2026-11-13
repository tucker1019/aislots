package play

import (
	"aislots/slots_service/internal/application/bet"
	"aislots/slots_service/internal/application/betlist"
	runtime "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/domain/identity"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"time"
)

type Service struct {
	store    Store
	games    bet.Games
	bets     *betlist.Service
	launcher LaunchVerifier
	profile  TestProfile
}

func New(store Store, games bet.Games, bets *betlist.Service, profile TestProfile) (*Service, error) {
	if store == nil || games == nil || bets == nil || !profile.Enabled || !profile.Player().Valid() || profile.InitialBalance < 1 {
		return nil, fmt.Errorf("explicit test profile and dependencies required")
	}
	return &Service{store: store, games: games, bets: bets, profile: profile}, nil
}
func TokenHash(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
func (s *Service) Login(ctx context.Context, r LoginRequest) (LoginResponse, error) {
	if r.LaunchTicket != "" {
		return s.launch(ctx, r)
	}
	if !s.profile.Enabled || !r.Test || r.AppName != s.profile.AppName || r.AppKey != s.profile.AppKey || r.UID != s.profile.UID {
		return LoginResponse{}, ErrUnauthorized
	}
	if _, err := s.games.Resolve(r.GameID, ""); err != nil {
		return LoginResponse{}, err
	}
	if _, err := s.bets.List(ctx, s.profile.Player(), r.GameID); err != nil {
		return LoginResponse{}, err
	}
	session := Session{Player: s.profile.Player(), GameID: r.GameID, ExpiresAt: time.Now().UTC().Add(24 * time.Hour)}
	token := rand.Text() + rand.Text()
	balance, err := s.store.CreateSession(ctx, TokenHash(token), session, s.profile.InitialBalance)
	if err != nil {
		return LoginResponse{}, err
	}
	return LoginResponse{AccessToken: token, ExpiresAt: session.ExpiresAt, Player: session.Player, Balance: money(balance)}, nil
}
func (s *Service) Authenticate(ctx context.Context, token string) (Session, error) {
	if token == "" {
		return Session{}, ErrUnauthorized
	}
	session, err := s.store.Session(ctx, TokenHash(token))
	if err != nil {
		return Session{}, err
	}
	if s.launcher != nil {
		matcher, ok := s.launcher.(interface{ Matches(identity.Context) bool })
		if !ok || !matcher.Matches(session.Player) {
			return Session{}, ErrUnauthorized
		}
	}
	if time.Now().After(session.ExpiresAt) {
		return Session{}, ErrUnauthorized
	}
	return session, nil
}
func (s *Service) Bets(ctx context.Context, session Session, gameID string) (betlist.Policy, error) {
	if session.GameID != gameID {
		return betlist.Policy{}, ErrUnauthorized
	}
	return s.bets.List(ctx, session.Player, gameID)
}
func (s *Service) Prepare(ctx context.Context, session Session, gameID string, amount int64) (Prepared, error) {
	if gameID != session.GameID {
		return Prepared{}, ErrUnauthorized
	}
	if err := s.bets.Allowed(ctx, session.Player, gameID, amount); err != nil {
		return Prepared{}, err
	}
	var prepared Prepared
	err := s.store.WithPlayer(ctx, session.Player, func(tx Tx) error {
		var err error
		prepared, err = s.prepareTx(ctx, tx, session, gameID, amount)
		return err
	})
	return prepared, err
}
func (s *Service) prepareTx(ctx context.Context, tx Tx, session Session, gameID string, amount int64) (Prepared, error) {
	var prepared Prepared
	err := func() error {
		open, ok, err := tx.FindOpen(ctx, gameID)
		if err != nil {
			return err
		}
		if ok {
			if open.Status == "active" {
				return ErrConflict
			}
			if open.Amount == amount && open.GameID == gameID && open.Player == session.Player && time.Now().Before(open.ExpiresAt) {
				prepared = prepareResponse(open)
				return nil
			}
			open.Status = "expired"
			if err = tx.SaveTicket(ctx, open); err != nil {
				return err
			}
		}
		state, err := tx.State(ctx, gameID)
		if err != nil {
			return err
		}
		if state.Pending {
			return ErrConflict
		}
		// A new paid ticket selects current rules. Active tickets and free spins
		// remain pinned to their original version until the whole bet completes.
		game, err := s.games.Resolve(gameID, "")
		if err != nil {
			return err
		}
		if tx.Balance() < amount {
			return ErrFunds
		}
		ticket := Ticket{ID: rand.Text(), Player: session.Player, GameID: gameID, Version: game.Version(), Status: "prepared", Amount: amount, ExpiresAt: time.Now().UTC().Add(2 * time.Minute)}
		if err = tx.SaveTicket(ctx, ticket); err != nil {
			return err
		}
		prepared = prepareResponse(ticket)
		return nil
	}()
	return prepared, err
}
func prepareResponse(t Ticket) Prepared {
	return Prepared{BetID: t.ID, BetAmount: money(t.Amount), ExpiresAt: t.ExpiresAt}
}
func (s *Service) Bet(ctx context.Context, session Session, gameID, id string) (Frame, error) {
	return s.advance(ctx, session, gameID, id, Cursor{0, 1}, true)
}
func (s *Service) Continue(ctx context.Context, session Session, gameID, id string, cursor Cursor) (Frame, error) {
	return s.advance(ctx, session, gameID, id, cursor, false)
}
func (s *Service) advance(ctx context.Context, session Session, gameID, id string, cursor Cursor, initial bool) (Frame, error) {
	if gameID != session.GameID {
		return Frame{}, ErrUnauthorized
	}
	if id == "" || len(id) > 128 || cursor.SpinIndex < 0 || cursor.StepIndex < 1 {
		return Frame{}, ErrInvalid
	}
	var response Frame
	err := s.store.WithPlayer(ctx, session.Player, func(tx Tx) error {
		var err error
		response, err = s.advanceTx(ctx, tx, session, gameID, id, cursor, initial)
		return err
	})
	return response, err
}

// advanceTx settles one round inside the caller's existing player transaction.
func (s *Service) advanceTx(ctx context.Context, tx Tx, session Session, gameID, id string, cursor Cursor, initial bool) (Frame, error) {
	var response Frame
	err := func() error {
		t, err := tx.Ticket(ctx, id)
		if err != nil {
			return err
		}
		if t.Player != session.Player || t.GameID != gameID {
			return ErrNotFound
		}
		saved, ok, err := tx.Frame(ctx, id, cursor.SpinIndex, cursor.StepIndex)
		if err != nil {
			return err
		}
		if ok {
			response = saved
			return nil
		}
		if t.Status == "prepared" {
			if !initial {
				return ErrConflict
			}
			if time.Now().After(t.ExpiresAt) {
				return ErrExpired
			}
			if err = s.bets.AllowedTotal(ctx, session.Player, gameID, t.Amount); err != nil {
				return err
			}
			if _, err = tx.Wallet(ctx, id+":debit", "debit", -t.Amount); err != nil {
				return err
			}
			t.Status = "active"
		} else {
			if initial || t.Status != "active" {
				return ErrConflict
			}
			prior, ok, err := tx.Frame(ctx, id, t.SpinIndex, t.StepIndex)
			if err != nil {
				return err
			}
			if !ok || prior.Next == nil || *prior.Next != cursor {
				return ErrConflict
			}
		}
		spin, exists, err := tx.Spin(ctx, id, cursor.SpinIndex)
		if err != nil {
			return err
		}
		if !exists {
			if cursor.StepIndex != 1 {
				return ErrConflict
			}
			state, err := tx.State(ctx, gameID)
			if err != nil {
				return err
			}
			stake := int64(0)
			if cursor.SpinIndex == 0 {
				if state.Pending {
					return ErrConflict
				}
				stake = t.Amount
			} else if !state.Pending {
				return ErrConflict
			}
			game, err := s.games.Resolve(gameID, t.Version)
			if err != nil {
				return err
			}
			result, err := game.Draw(ctx, runtime.Request{BetMinorUnits: stake, State: state})
			if err != nil {
				return err
			}
			if result.GameID != gameID || result.ChargeMinorUnits != stake || result.Version != game.Version() || result.RuleType != game.Type() {
				return fmt.Errorf("engine settlement mismatch")
			}
			if err = result.Validate(); err != nil {
				return err
			}
			if err = game.ValidateStoredResult(result); err != nil {
				return err
			}
			spin = StoredSpin{Result: result}
			if err = tx.SaveSpin(ctx, id, cursor.SpinIndex, spin); err != nil {
				return err
			}
		}
		result := spin.Result
		module, err := s.games.Resolve(gameID, t.Version)
		if err != nil {
			return err
		}
		if err = result.Validate(); err != nil {
			return err
		}
		if result.GameID != gameID || result.Version != t.Version || result.RuleType != module.Type() {
			return fmt.Errorf("stored settlement identity mismatch")
		}
		if err = module.ValidateStoredResult(result); err != nil {
			return err
		}
		if cursor.StepIndex > len(result.Frames) {
			return ErrConflict
		}
		plan := result.Frames[cursor.StepIndex-1]
		presentation, err := module.Present(result, runtime.FrameContext{RoundID: id, SpinIndex: cursor.SpinIndex, FrameIndex: cursor.StepIndex - 1})
		if err != nil {
			return err
		}
		var frame Frame
		if err = json.Unmarshal(presentation, &frame); err != nil {
			return err
		}
		// Presentation cannot supply financial fields, identity or progress.
		frame.BetID = id
		frame.SpinIndex = cursor.SpinIndex
		frame.StepIndex = cursor.StepIndex
		frame.Status = "ready"
		frame.BetAmount = money(result.BetMinorUnits)
		frame.WinAmount = money(plan.WinMinorUnits)
		frame.NextAction = plan.NextAction
		frame.Next = nil
		frame.RequestID = ""
		frame.NextRequestID = ""
		amount := plan.WinMinorUnits
		if t.TotalWin > math.MaxInt64-amount {
			return fmt.Errorf("win total overflow")
		}
		if amount > 0 {
			if _, err = tx.Wallet(ctx, fmt.Sprintf("%s:%d:%d:credit", id, cursor.SpinIndex, cursor.StepIndex), "credit", amount); err != nil {
				return err
			}
		}
		t.TotalWin += amount
		if cursor.StepIndex < len(result.Frames) {
			frame.Next = &Cursor{cursor.SpinIndex, cursor.StepIndex + 1}
		} else {
			if err = tx.SaveState(ctx, gameID, result.NextState); err != nil {
				return err
			}
			if result.NextState.Pending {
				frame.Next = &Cursor{cursor.SpinIndex + 1, 1}
			} else {
				t.Status = "complete"
			}
		}
		frame.TotalWinAmount = money(t.TotalWin)
		frame.Balance = money(tx.Balance())
		t.SpinIndex = cursor.SpinIndex
		t.StepIndex = cursor.StepIndex
		if err = tx.SaveTicket(ctx, t); err != nil {
			return err
		}
		if err = tx.SaveFrame(ctx, frame); err != nil {
			return err
		}
		if err = tx.EnqueueOutbox(ctx, fmt.Sprintf("spin-frame:%s:%d:%d", id, cursor.SpinIndex, cursor.StepIndex), "spin.frame.settled", id, frame); err != nil {
			return err
		}
		response = frame
		return nil
	}()
	return response, err
}

func (s *Service) Recover(ctx context.Context, session Session, gameID string) (Recovery, error) {
	if gameID != session.GameID {
		return Recovery{}, ErrUnauthorized
	}
	var response Recovery
	err := s.store.WithPlayer(ctx, session.Player, func(tx Tx) error {
		response = Recovery{Status: "idle", Balance: money(tx.Balance())}
		t, ok, err := tx.FindOpen(ctx, gameID)
		if err != nil || !ok {
			return err
		}
		if t.Player != session.Player || t.GameID != gameID {
			return ErrConflict
		}
		response.BetID = t.ID
		response.Status = t.Status
		if t.Status == "prepared" {
			if time.Now().After(t.ExpiresAt) {
				t.Status = "expired"
				if err = tx.SaveTicket(ctx, t); err != nil {
					return err
				}
				response.Status = "idle"
				response.BetID = ""
				return nil
			}
			p := prepareResponse(t)
			response.Prepared = &p
			return nil
		}
		f, ok, err := tx.Frame(ctx, t.ID, t.SpinIndex, t.StepIndex)
		if err != nil {
			return err
		}
		if !ok {
			return ErrConflict
		}
		response.Frame = &f
		return nil
	})
	return response, err
}
func money(n int64) int64 { return n }

// Inspect returns only the latest delivered frame for a known bet, including a completed bet.
// This resolves a lost final response without reopening a new wager.
func (s *Service) Inspect(ctx context.Context, session Session, gameID, id string) (Recovery, error) {
	if gameID != session.GameID {
		return Recovery{}, ErrUnauthorized
	}
	var out Recovery
	err := s.store.WithPlayer(ctx, session.Player, func(tx Tx) error {
		t, err := tx.Ticket(ctx, id)
		if err != nil {
			return err
		}
		if t.Player != session.Player || t.GameID != gameID {
			return ErrNotFound
		}
		out = Recovery{BetID: id, Status: t.Status, Balance: money(tx.Balance())}
		if t.Status == "prepared" {
			p := prepareResponse(t)
			out.Prepared = &p
			return nil
		}
		if t.StepIndex > 0 {
			f, ok, err := tx.Frame(ctx, id, t.SpinIndex, t.StepIndex)
			if err != nil {
				return err
			}
			if ok {
				out.Frame = &f
			}
		}
		return nil
	})
	return out, err
}
