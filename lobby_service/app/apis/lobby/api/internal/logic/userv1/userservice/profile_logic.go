package userservice

import (
	"context"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
)

func profileReply(user *model.Profile, err error) (*pb.ProfileReply, error) {
	if err != nil {
		return nil, xerr.Public(err)
	}
	return &pb.ProfileReply{Uid: user.UID, Nickname: user.Nickname, AvatarId: user.AvatarID, Coins: user.Coins}, nil
}

func (s *Service) ProfileInfo(ctx context.Context, r *pb.UserRequest) (*pb.ProfileReply, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	return profileReply(s.Store.Profile(ctx, r.GetUid(), Hash(r.GetSid()), time.Now().UTC()))
}

func (s *Service) ProfileUpdate(ctx context.Context, r *pb.UserRequest) (*pb.ProfileReply, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	if r.Nickname == nil && r.AvatarId == nil {
		return nil, xerr.ErrInvalid
	}
	if r.AvatarId != nil && (*r.AvatarId < 1 || *r.AvatarId > 15) {
		return nil, xerr.ErrInvalid
	}
	if r.Nickname != nil {
		name := strings.TrimSpace(*r.Nickname)
		if !utf8.ValidString(name) || utf8.RuneCountInString(name) < 1 || utf8.RuneCountInString(name) > 24 || strings.ContainsFunc(name, unicode.IsControl) {
			return nil, xerr.ErrInvalid
		}
		r.Nickname = &name
	}
	return profileReply(s.Store.UpdateProfile(ctx, r.GetUid(), Hash(r.GetSid()), time.Now().UTC(), r.Nickname, r.AvatarId))
}
