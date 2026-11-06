package userservice

import (
	"apps/app/apis/lobby/api/internal/repository"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
	"context"
	"errors"
	"golang.org/x/crypto/bcrypt"
	"strings"
	"testing"
	"time"
)

type securityFake struct {
	repository.UserStore
	calls int
	err   error
}

func (s *securityFake) ChangePassword(_ context.Context, uid int64, sid, old, hash string, _ time.Time) error {
	s.calls++
	if uid != 7 || sid != Hash(strings.Repeat("a", 52)) || old != "old-password" || bcrypt.CompareHashAndPassword([]byte(hash), []byte("new-password")) != nil {
		return errors.New("invalid update")
	}
	return s.err
}
func (s *securityFake) Logout(_ context.Context, uid int64, sid string) error {
	s.calls++
	return s.err
}
func TestSecurityActions(t *testing.T) {
	ctx := context.Background()
	store := &securityFake{}
	s := &Service{Store: store}
	uid := int64(7)
	sid := strings.Repeat("a", 52)
	r := &pb.SecurityRequest{Uid: &uid, Sid: &sid, OldPassword: "old-password", NewPassword: "new-password"}
	if _, e := s.PasswordUpdate(ctx, &pb.SecurityRequest{}); !errors.Is(e, xerr.ErrSession) {
		t.Fatal(e)
	}
	bad := &pb.SecurityRequest{Uid: r.Uid, Sid: r.Sid, OldPassword: r.OldPassword, NewPassword: r.OldPassword}
	if _, e := s.PasswordUpdate(ctx, bad); !errors.Is(e, xerr.ErrInvalid) {
		t.Fatal(e)
	}
	if store.calls != 0 {
		t.Fatal("invalid input reached store")
	}
	if v, e := s.PasswordUpdate(ctx, r); e != nil || !v.Success {
		t.Fatal(v, e)
	}
	store.err = xerr.ErrCredentials
	if _, e := s.PasswordUpdate(ctx, r); !errors.Is(e, xerr.ErrCredentials) {
		t.Fatal(e)
	}
	store.err = nil
	if v, e := s.SessionLogout(ctx, r); e != nil || !v.Success {
		t.Fatal(v, e)
	}
}
