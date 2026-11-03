package play

import (
	"aislots/slots_service/internal/application/bet"
	"aislots/slots_service/internal/application/betlist"
	"aislots/slots_service/internal/domain/identity"
	"context"
	"fmt"
	"time"
)

type LaunchVerifier interface {
	VerifyLaunch(context.Context, string, string, string) (identity.Context, int64, string, error)
}

func NewLive(store Store, games bet.Games, bets *betlist.Service, launcher LaunchVerifier) (*Service, error) {
	if store == nil || games == nil || bets == nil || launcher == nil {
		return nil, fmt.Errorf("live dependencies required")
	}
	return &Service{store: store, games: games, bets: bets, launcher: launcher}, nil
}
func (s *Service) launch(ctx context.Context, r LoginRequest) (LoginResponse, error) {
	if s.launcher == nil || r.Test || len(r.LaunchTicket) != 52 || len(r.ExchangeID) < 16 || len(r.ExchangeID) > 128 {
		return LoginResponse{}, ErrUnauthorized
	}
	if _, e := s.games.Resolve(r.GameID, ""); e != nil {
		return LoginResponse{}, e
	}
	p, balance, token, e := s.launcher.VerifyLaunch(ctx, r.LaunchTicket, r.ExchangeID, r.GameID)
	if e != nil {
		return LoginResponse{}, e
	}
	if _, e = s.bets.List(ctx, p, r.GameID); e != nil {
		return LoginResponse{}, e
	}
	session := Session{Player: p, GameID: r.GameID, ExpiresAt: time.Now().UTC().Add(24 * time.Hour)}
	if _, e = s.store.CreateSession(ctx, TokenHash(token), session, balance); e != nil {
		return LoginResponse{}, e
	}
	session, e = s.store.Session(ctx, TokenHash(token))
	if e != nil {
		return LoginResponse{}, e
	}
	return LoginResponse{AccessToken: token, ExpiresAt: session.ExpiresAt, Player: p, Balance: balance}, nil
}
