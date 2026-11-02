package vipservice

import (
	"context"
	"strings"
	"time"
	"unicode"

	"apps/app/apis/lobby/api/internal/config"
	userlogic "apps/app/apis/lobby/api/internal/logic/userv1/userservice"
	"apps/app/apis/lobby/api/internal/repository"
	"apps/app/apis/lobby/api/internal/repository/model"
	"apps/app/apis/lobby/api/internal/svc"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
)

type Logic struct {
	store    repository.VIPStore
	config   config.VIPConfig
	location *time.Location
}

func New(s *svc.ServiceContext) *Logic {
	return &Logic{store: s.Repo.VIP, config: s.Config.VIP, location: s.Config.Checkin.Location()}
}

func instant(t *time.Time) string {
	if t == nil {
		return ""
	}
	return t.UTC().Format(time.RFC3339Nano)
}

func (l *Logic) VipInfo(ctx context.Context, r *pb.VipRequest) (*pb.VipInfoReply, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	now := time.Now().UTC()
	v, err := l.store.ReadVIP(ctx, r.GetUid(), userlogic.Hash(r.GetSid()), now)
	if err != nil {
		return nil, xerr.Public(err)
	}
	s := v.State
	status := "normal"
	if s.ProtectionEnd != nil {
		status = "protecting"
	}
	out := &pb.VipInfoReply{ActivityDate: now.In(l.location).Format(time.DateOnly), Timezone: l.location.String(), IdleDays: l.config.IdleDays, ProtectionDays: l.config.ProtectionDays, UpgradeClaimableTotal: v.UpgradeTotal, Levels: []*pb.VipLevel{}, UpgradeRewards: []*pb.VipReward{}, State: &pb.VipState{Level: s.Level, HighestLevel: s.HighestLevel, UpgradeBet: s.UpgradeBet, UpgradeRecharge: s.UpgradeRecharge, Status: status, IdleSince: instant(&s.IdleSince), ProtectionStart: instant(s.ProtectionStart), ProtectionEnd: instant(s.ProtectionEnd), ProtectionBet: s.ProtectionBet, ProtectionRecharge: s.ProtectionRecharge, ProtectionRequiredBet: s.ProtectionRequiredBet, ProtectionRequiredRecharge: s.ProtectionRequiredRecharge}, Weekly: rewardReply(v.Weekly, now), Monthly: rewardReply(v.Monthly, now), WeeklyPreview: rewardReply(v.WeeklyPreview, now), MonthlyPreview: rewardReply(v.MonthlyPreview, now)}
	for _, c := range l.config.Levels {
		out.Levels = append(out.Levels, &pb.VipLevel{Level: c.Level, UpgradeBet: c.UpgradeBet, UpgradeRecharge: c.UpgradeRecharge, KeepBet: c.KeepBet, KeepRecharge: c.KeepRecharge, UpgradeReward: c.UpgradeReward, WeeklyReward: c.WeeklyReward, MonthlyReward: c.MonthlyReward, BirthdayReward: c.BirthdayReward, WeeklyBet: c.WeeklyBet, WeeklyRecharge: c.WeeklyRecharge, MonthlyBet: c.MonthlyBet, MonthlyRecharge: c.MonthlyRecharge})
	}
	for _, reward := range v.Upgrades {
		out.UpgradeRewards = append(out.UpgradeRewards, rewardReply(reward, now))
	}
	return out, nil
}

func (l *Logic) VipUpgradeClaim(ctx context.Context, r *pb.VipRequest) (*pb.VipClaimReply, error) {
	return l.claim(ctx, r, "upgrade")
}

func (l *Logic) VipWeeklyClaim(ctx context.Context, r *pb.VipRequest) (*pb.VipClaimReply, error) {
	return l.claim(ctx, r, "weekly")
}

func (l *Logic) VipMonthlyClaim(ctx context.Context, r *pb.VipRequest) (*pb.VipClaimReply, error) {
	return l.claim(ctx, r, "monthly")
}

func (l *Logic) claim(ctx context.Context, r *pb.VipRequest, kind string) (*pb.VipClaimReply, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	if r.RequestId == "" || len(r.RequestId) > 128 || strings.TrimSpace(r.RequestId) != r.RequestId || strings.ContainsFunc(r.RequestId, unicode.IsControl) {
		return nil, xerr.ErrInvalid
	}
	if _, err := time.Parse(time.DateOnly, r.ActivityDate); err != nil {
		return nil, xerr.ErrInvalid
	}
	now := time.Now().UTC()
	receipt, err := l.store.ClaimVIP(ctx, r.GetUid(), userlogic.Hash(r.GetSid()), kind, r.RequestId, r.ActivityDate, now)
	if err != nil {
		return nil, xerr.Public(err)
	}
	out := &pb.VipClaimReply{ClaimId: receipt.Batch.ClaimID, TotalReward: receipt.Batch.TotalReward, Coins: receipt.Batch.Coins, Items: []*pb.VipReward{}}
	for _, reward := range receipt.Items {
		out.Items = append(out.Items, rewardReply(reward, now))
	}
	return out, nil
}

func rewardReply(r *model.LobbyVipReward, now time.Time) *pb.VipReward {
	if r == nil {
		return &pb.VipReward{}
	}
	status := r.Status
	if status == "pending" {
		status = "claimable"
		if r.ExpiresAt != nil && !now.Before(*r.ExpiresAt) {
			status = "expired"
		}
	}
	return &pb.VipReward{RewardId: r.RewardID, Kind: r.Kind, Level: r.Level, Amount: r.Amount, Status: status, PeriodStart: r.PeriodStart, PeriodEnd: r.PeriodEnd, AvailableAt: instant(&r.AvailableAt), ExpiresAt: instant(r.ExpiresAt), RequiredBet: r.RequiredBet, RequiredRecharge: r.RequiredRecharge, ActualBet: r.ActualBet, ActualRecharge: r.ActualRecharge}
}
