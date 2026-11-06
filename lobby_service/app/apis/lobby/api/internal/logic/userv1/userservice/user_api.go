package userservice

import (
	"context"
	"time"

	"apps/pkg/xerr"

	pb "apps/pb/apis/lobby/api/v1"
)

func reply(id Identity, err error) (*pb.IdentityReply, error) {
	if err != nil {
		return nil, xerr.Public(err)
	}
	return &pb.IdentityReply{Uid: id.UID, Sid: id.SID, ExpiresAt: id.ExpiresAt.Format(time.RFC3339Nano)}, nil
}

func (l *Service) VisitorLogin(ctx context.Context, r *pb.UserRequest) (*pb.IdentityReply, error) {
	return nil, xerr.Public(xerr.ErrInvalid)
}

func (l *Service) SessionRenewal(ctx context.Context, r *pb.UserRequest) (*pb.IdentityReply, error) {
	return reply(l.Renew(ctx, r.GetUid(), r.GetSid()))
}

func (l *Service) UniqueCodeRegister(ctx context.Context, r *pb.UserRequest) (*pb.IdentityReply, error) {
	return reply(l.Register(ctx, r.Account, r.Password, r.InviteCode))
}

func (l *Service) UniqueCodeLogin(ctx context.Context, r *pb.UserRequest) (*pb.IdentityReply, error) {
	return reply(l.Login(ctx, r.GetUid(), r.GetSid(), r.Account, r.Password))
}

func (l *Service) UniqueCodeBind(ctx context.Context, r *pb.UserRequest) (*pb.IdentityReply, error) {
	return reply(l.Bind(ctx, r.GetUid(), r.GetSid(), r.Account, r.Password))
}
