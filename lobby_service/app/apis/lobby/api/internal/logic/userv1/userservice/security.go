package userservice

import (
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
	"context"
	"golang.org/x/crypto/bcrypt"
	"time"
	"unicode/utf8"
)

type securityStore interface {
	ChangePassword(context.Context, int64, string, string, string, time.Time) error
	Logout(context.Context, int64, string) error
}

func (s *Service) PasswordUpdate(ctx context.Context, r *pb.SecurityRequest) (*pb.SecurityReply, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	if len(r.OldPassword) == 0 || len(r.OldPassword) > 72 || len(r.NewPassword) < 8 || len(r.NewPassword) > 72 || !utf8.ValidString(r.NewPassword) || r.NewPassword == r.OldPassword {
		return nil, xerr.ErrInvalid
	}
	store, ok := s.Store.(securityStore)
	if !ok {
		return nil, xerr.ErrInvalid
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(r.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		return nil, xerr.Public(err)
	}
	if err = store.ChangePassword(ctx, r.GetUid(), Hash(r.GetSid()), r.OldPassword, string(hash), time.Now().UTC()); err != nil {
		return nil, xerr.Public(err)
	}
	return &pb.SecurityReply{Success: true}, nil
}
func (s *Service) SessionLogout(ctx context.Context, r *pb.SecurityRequest) (*pb.SecurityReply, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	store, ok := s.Store.(securityStore)
	if !ok {
		return nil, xerr.ErrInvalid
	}
	if err := store.Logout(ctx, r.GetUid(), Hash(r.GetSid())); err != nil {
		return nil, xerr.Public(err)
	}
	return &pb.SecurityReply{Success: true}, nil
}
