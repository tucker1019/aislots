package play

import (
	"context"
	"crypto/rand"
	"fmt"
)

// 分享凭据只授予一笔交易的读取能力，不是登录会话。
type ReplayShare struct {
	BetID      string `json:"betId"`
	ShareToken string `json:"shareToken"`
}
type ReplayShareStore interface {
	SaveReplayShare(context.Context, string, Session, string) error
	ReplayShareSession(context.Context, string, string, string) (Session, error)
}

func (s *Service) CreateReplayShare(ctx context.Context, session Session, gameID, betID string) (ReplayShare, error) {
	if _, err := s.BetReplay(ctx, session, gameID, betID, 1, ""); err != nil {
		return ReplayShare{}, err
	}
	store, ok := s.store.(ReplayShareStore)
	if !ok {
		return ReplayShare{}, fmt.Errorf("replay sharing store unavailable")
	}
	token := rand.Text() + rand.Text()
	if err := store.SaveReplayShare(ctx, TokenHash(token), session, betID); err != nil {
		return ReplayShare{}, err
	}
	return ReplayShare{BetID: betID, ShareToken: token}, nil
}
func (s *Service) SharedReplay(ctx context.Context, gameID, betID, token string, limit int, cursor string) (BetReplay, error) {
	if len(token) != 52 || betID == "" || len(betID) > 128 {
		return BetReplay{}, ErrNotFound
	}
	store, ok := s.store.(ReplayShareStore)
	if !ok {
		return BetReplay{}, ErrNotFound
	}
	session, err := store.ReplayShareSession(ctx, TokenHash(token), gameID, betID)
	if err != nil {
		return BetReplay{}, err
	}
	out, err := s.BetReplay(ctx, session, gameID, betID, limit, cursor)
	if err != nil {
		return BetReplay{}, err
	}
	for i := range out.Frames {
		out.Frames[i].Balance = 0
	}
	return out, nil
}
