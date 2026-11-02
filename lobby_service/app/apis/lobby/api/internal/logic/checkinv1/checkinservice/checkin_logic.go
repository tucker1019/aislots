package checkinservice

import (
	"context"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	userlogic "apps/app/apis/lobby/api/internal/logic/userv1/userservice"
	"apps/app/apis/lobby/api/internal/repository"
	"apps/app/apis/lobby/api/internal/svc"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
)

type Logic struct {
	store  repository.CheckinStore
	config config.CheckinConfig
}

func New(s *svc.ServiceContext) *Logic {
	return &Logic{store: s.Repo.Checkin, config: s.Config.Checkin}
}

func rule(day int32, r config.CheckinDay) *pb.CheckinDay {
	return &pb.CheckinDay{Day: day, RequiredBet: r.RequiredBet, RequiredRecharge: r.RequiredRecharge, Reward: r.Reward}
}

func (l *Logic) CheckinInfo(ctx context.Context, r *pb.CheckinRequest) (*pb.CheckinInfoReply, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	now := time.Now().UTC()
	s, err := l.store.ReadCheckin(ctx, r.GetUid(), userlogic.Hash(r.GetSid()), l.config, now)
	if err != nil {
		return nil, xerr.Public(err)
	}
	date, _ := time.ParseInLocation(time.DateOnly, s.Date, l.config.Location())
	out := &pb.CheckinInfoReply{ActivityDate: s.Date, Timezone: l.config.Timezone, NextResetAt: date.AddDate(0, 0, 1).Format(time.RFC3339), CurrentDay: s.Day, Claimed: s.Claimed, CanClaim: !s.Claimed && s.Daily.ValidBet >= s.Rule.RequiredBet && s.Daily.RechargeAmount >= s.Rule.RequiredRecharge, ValidBet: s.Daily.ValidBet, RechargeAmount: s.Daily.RechargeAmount, Current: rule(s.Day, s.Rule)}
	for i, d := range l.config.Days {
		out.Days = append(out.Days, rule(int32(i+1), d))
	}
	return out, nil
}

func (l *Logic) CheckinClaim(ctx context.Context, r *pb.CheckinRequest) (*pb.CheckinClaimReply, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	if _, err := time.Parse(time.DateOnly, r.ActivityDate); err != nil {
		return nil, xerr.ErrInvalid
	}
	c, err := l.store.ClaimCheckin(ctx, r.GetUid(), userlogic.Hash(r.GetSid()), r.ActivityDate, l.config, time.Now().UTC())
	if err != nil {
		return nil, xerr.Public(err)
	}
	return &pb.CheckinClaimReply{ClaimId: c.ClaimID, ActivityDate: c.BusinessDate, Day: c.Day, Reward: c.Reward, Coins: c.Coins}, nil
}
