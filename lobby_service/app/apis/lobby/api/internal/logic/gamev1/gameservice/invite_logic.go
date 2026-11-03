package gameservice

import (
	"context"
	"net/url"
	"strings"
	"time"
	"unicode"

	user "apps/app/apis/lobby/api/internal/logic/userv1/userservice"
	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
)

type inviteStore interface {
	Read(context.Context, int64, time.Time) (*model.InviteView, error)
	Claim(context.Context, int64, string, time.Time) (*model.LobbyInviteBatch, error)
}

func (l *Logic) inviteAuth(ctx context.Context, r *pb.InviteRequest) error {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return xerr.ErrSession
	}
	if e := l.users.Check(ctx, r.GetUid(), user.Hash(r.GetSid()), time.Now().UTC()); e != nil {
		return xerr.Public(e)
	}
	if l.invite == nil {
		return xerr.ErrInvalid
	}
	return nil
}

func (l *Logic) InviteInfo(ctx context.Context, r *pb.InviteRequest) (*pb.InviteInfoReply, error) {
	if e := l.inviteAuth(ctx, r); e != nil {
		return nil, e
	}
	v, e := l.invite.Read(ctx, r.GetUid(), time.Now().UTC())
	if e != nil {
		return nil, xerr.Public(e)
	}
	c := l.inviteConfig
	u, _ := url.Parse(c.BaseURL)
	q := u.Query()
	q.Set("inviteCode", v.Code)
	u.RawQuery = q.Encode()
	return &pb.InviteInfoReply{InviteUrl: u.String(), SupportUrl: c.SupportURL, Rules: &pb.InviteRules{Version: c.Version, DurationDays: c.DurationDays, MinDepositCount: c.MinDepositCount, MinDepositAmount: c.MinDepositAmount, MinBetAmount: c.MinBetAmount, RewardAmount: c.RewardAmount, DisplayRows: c.DisplayRows}, InvitedCount: v.InvitedCount, QualifiedCount: v.QualifiedCount, PendingAmount: v.PendingAmount, ClaimedAmount: v.ClaimedAmount}, nil
}

func (l *Logic) InviteClaim(ctx context.Context, r *pb.InviteRequest) (*pb.InviteClaimReply, error) {
	if e := l.inviteAuth(ctx, r); e != nil {
		return nil, e
	}
	if !validInviteRequestID(r.RequestId) {
		return nil, xerr.ErrInvalid
	}
	b, e := l.invite.Claim(ctx, r.GetUid(), r.RequestId, time.Now().UTC())
	if e != nil {
		return nil, xerr.Public(e)
	}
	return &pb.InviteClaimReply{ClaimId: b.ClaimID, TotalReward: b.TotalReward, Coins: b.Coins}, nil
}

func validInviteRequestID(id string) bool {
	return id != "" && len(id) <= 128 && strings.TrimSpace(id) == id && !strings.ContainsFunc(id, unicode.IsControl)
}
