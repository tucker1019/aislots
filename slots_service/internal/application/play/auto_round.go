package play

import (
	"aislots/slots_service/internal/domain/identity"
	"context"
	"math"
	"strings"
	"time"
)

type AutoRoundRequest struct {
	RequestID string `json:"requestId"`
	UID       int64  `json:"uid"`
	GameID    string `json:"gameId"`
	Bet       int64  `json:"bet"`
	BetLevel  int    `json:"betLevel"`
	Country   string `json:"country"`
	Currency  string `json:"currency"`
}
type AutoRoundReply struct {
	Status    string `json:"status"`
	RequestID string `json:"requestId"`
	BetID     string `json:"betId"`
}
type AutoRoundState struct {
	RequestID, BetID, SpinToken string
	Amount                      int64
	Done                        bool
}
type autoRoundStore interface {
	RunAutoRound(context.Context, Session, string, int64, func(*AutoRoundState, func() error) error) (AutoRoundReply, error)
}

// AutoRound is available only to the authenticated platform. Account classification stays at the platform.
func (s *Service) AutoRound(ctx context.Context, r AutoRoundRequest) (AutoRoundReply, error) {
	provider, ok := s.launcher.(interface {
		AutoPlayer(int64, string, string) (identity.Context, error)
	})
	if !ok {
		return AutoRoundReply{}, ErrUnauthorized
	}
	if r.UID <= 0 || r.GameID != "AG1" || r.RequestID == "" || len(r.RequestID) > 128 || strings.TrimSpace(r.RequestID) != r.RequestID || r.Bet <= 0 || r.BetLevel < 1 {
		return AutoRoundReply{}, ErrInvalid
	}
	p, e := provider.AutoPlayer(r.UID, r.Country, r.Currency)
	if e != nil {
		return AutoRoundReply{}, e
	}
	session := Session{Player: p, GameID: r.GameID, ExpiresAt: time.Now().Add(time.Hour)}
	policy, e := s.Bets(ctx, session, r.GameID)
	if e != nil {
		return AutoRoundReply{}, e
	}
	allowed := false
	for _, b := range policy.Amounts {
		if b == r.Bet {
			allowed = true
		}
	}
	if !allowed || r.BetLevel > policy.BetLevel || policy.LineCount < 1 || r.Bet > math.MaxInt64/int64(policy.LineCount)/int64(r.BetLevel) {
		return AutoRoundReply{}, ErrInvalid
	}
	amount := r.Bet * int64(policy.LineCount) * int64(r.BetLevel)
	store, ok := s.store.(autoRoundStore)
	if !ok {
		return AutoRoundReply{}, ErrInvalid
	}
	return store.RunAutoRound(ctx, session, r.RequestID, amount, func(job *AutoRoundState, save func() error) error {
		if job.SpinToken == "" {
			state, err := s.Status(ctx, session, r.GameID)
			if err != nil {
				return err
			}
			if state.HasNext {
				return ErrConflict
			}
			job.SpinToken = state.RequestID
			if err = save(); err != nil {
				return err
			}
		}
		for !job.Done {
			if err := ctx.Err(); err != nil {
				return err
			}
			frame, err := s.Spin(ctx, session, r.GameID, job.SpinToken, amount)
			if err != nil {
				return err
			}
			if job.BetID != "" && job.BetID != frame.BetID {
				return ErrConflict
			}
			job.BetID = frame.BetID
			job.SpinToken = frame.NextRequestID
			job.Done = frame.NextAction == "complete"
			if frame.NextAction != "complete" && frame.NextAction != "continue" && frame.NextAction != "start_free" {
				return ErrConflict
			}
			if err = save(); err != nil {
				return err
			}
		}
		return nil
	})
}
