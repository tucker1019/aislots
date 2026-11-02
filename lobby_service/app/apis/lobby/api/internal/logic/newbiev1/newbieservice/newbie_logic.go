package newbieservice

import (
	"context"
	"strings"
	"time"
	"unicode"

	userlogic "apps/app/apis/lobby/api/internal/logic/userv1/userservice"
	"apps/app/apis/lobby/api/internal/repository"
	"apps/app/apis/lobby/api/internal/repository/model"
	"apps/app/apis/lobby/api/internal/svc"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
)

type Logic struct{ store repository.NewbieStore }

func New(s *svc.ServiceContext) *Logic { return &Logic{store: s.Repo.Newbie} }
func tierReply(t *model.LobbyNewbieRechargeTier, progress, remaining int64, status string) *pb.NewbieRechargeTier {
	return &pb.NewbieRechargeTier{Id: t.TierID, RequiredRecharge: t.RequiredRecharge, Reward: t.Reward, Progress: progress, Remaining: remaining, Status: status}
}

func (l *Logic) NewbieRechargeInfo(ctx context.Context, r *pb.NewbieRechargeRequest) (*pb.NewbieRechargeInfoReply, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	now := time.Now().UTC()
	v, err := l.store.ReadNewbie(ctx, r.GetUid(), userlogic.Hash(r.GetSid()), now)
	if err != nil {
		return nil, xerr.Public(err)
	}
	status := "active"
	if !now.Before(v.Enrollment.EndsAt) {
		status = "ended"
	}
	if !v.Enrollment.EnrolledAt.Before(v.Enrollment.EndsAt) {
		status = "ineligible"
	}
	out := &pb.NewbieRechargeInfoReply{StartsAt: v.Enrollment.StartsAt.UTC().Format(time.RFC3339Nano), EndsAt: v.Enrollment.EndsAt.UTC().Format(time.RFC3339Nano), DurationDays: v.Enrollment.DurationDays, Status: status, RechargeAmount: v.Amount, ClaimableTotal: v.ClaimableTotal, ConfigVersion: v.Enrollment.ConfigVersion, ExpireUnclaimed: v.Enrollment.ExpireUnclaimed, RemainingSeconds: max(int64(v.Enrollment.EndsAt.Sub(now).Seconds()), 0), Items: []*pb.NewbieRechargeTier{}}
	for _, t := range v.Items {
		out.Items = append(out.Items, tierReply(&t.Tier, t.Progress, t.Remaining, t.Status))
	}
	return out, nil
}

func (l *Logic) NewbieRechargeClaim(ctx context.Context, r *pb.NewbieRechargeRequest) (*pb.NewbieRechargeClaimReply, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	if r.RequestId == "" || len(r.RequestId) > 128 || strings.TrimSpace(r.RequestId) != r.RequestId || strings.ContainsFunc(r.RequestId, unicode.IsControl) {
		return nil, xerr.ErrInvalid
	}
	receipt, err := l.store.ClaimNewbie(ctx, r.GetUid(), userlogic.Hash(r.GetSid()), r.RequestId, time.Now().UTC())
	if err != nil {
		return nil, xerr.Public(err)
	}
	out := &pb.NewbieRechargeClaimReply{ClaimId: receipt.Batch.ClaimID, TotalReward: receipt.Batch.TotalReward, Coins: receipt.Batch.Coins, Items: []*pb.NewbieRechargeTier{}}
	for _, t := range receipt.Items {
		out.Items = append(out.Items, tierReply(t, t.RequiredRecharge, 0, "claimed"))
	}
	return out, nil
}
