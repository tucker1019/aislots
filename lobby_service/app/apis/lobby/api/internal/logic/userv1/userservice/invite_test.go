package userservice

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/repository"
	pb "apps/pb/apis/lobby/api/v1"
)

type invitedStore struct {
	repository.UserStore
	code string
	err  error
}

func (s *invitedStore) CreateInvited(_ context.Context, token string, expiry time.Time, code string) (int64, error) {
	s.code = code
	if len(token) != 64 || !expiry.After(time.Now()) {
		return 0, errors.New("invalid session")
	}
	return 999, s.err
}

func TestVisitorInviteDispatch(t *testing.T) {
	store := &invitedStore{}
	s := &Service{Store: store, TTL: time.Hour}
	ctx := context.Background()
	v, e := s.VisitorLogin(ctx, &pb.UserRequest{InviteCode: "ABC"})
	if e != nil || v.Uid != 999 || store.code != "ABC" {
		t.Fatal(v, e)
	}
	store.err = errors.New("db")
	if _, e = s.VisitorLogin(ctx, &pb.UserRequest{InviteCode: "ABC"}); e == nil {
		t.Fatal("store error")
	}
	for _, code := range []string{strings.Repeat("x", 65), " bad"} {
		if _, e = s.CreateInvited(ctx, code); e == nil {
			t.Fatal("invalid code")
		}
	}
	s.Store = struct{ repository.UserStore }{}
	if _, e = s.CreateInvited(ctx, "ABC"); e == nil {
		t.Fatal("unsupported store")
	}
}
