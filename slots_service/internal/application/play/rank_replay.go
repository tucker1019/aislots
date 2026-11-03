package play

import (
	"aislots/slots_service/internal/domain/identity"
	"context"
)

type rankReplayStore interface {
	RankReplaySession(context.Context, string, string, string) (Session, error)
}

// Called only by the authenticated platform adapter, never with a browser login token.
func (s *Service) RankReplay(ctx context.Context, game, betID, uid string) (ReplayShare, error) {
	store, ok := s.store.(rankReplayStore)
	if !ok || s.launcher == nil {
		return ReplayShare{}, ErrNotFound
	}
	session, err := store.RankReplaySession(ctx, game, betID, uid)
	if err != nil {
		return ReplayShare{}, err
	}
	matcher, ok := s.launcher.(interface{ Matches(identity.Context) bool })
	if !ok || !matcher.Matches(session.Player) {
		return ReplayShare{}, ErrNotFound
	}
	return s.CreateReplayShare(ctx, session, game, betID)
}
