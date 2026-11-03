package returnservice

import (
	"context"
	"sort"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	userlogic "apps/app/apis/lobby/api/internal/logic/userv1/userservice"
	"apps/app/apis/lobby/api/internal/repository"
	"apps/app/apis/lobby/api/internal/repository/model"
	"apps/app/apis/lobby/api/internal/svc"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
)

type Logic struct {
	games    config.GameConfig
	store    repository.ReturnStore
	config   config.ReturnConfig
	location *time.Location
}

func New(s *svc.ServiceContext) *Logic {
	return &Logic{games: s.Config.Game, store: s.Repo.Returns, config: s.Config.Returns, location: s.Config.Checkin.Location()}
}

func (l *Logic) info(ctx context.Context, r *pb.ReturnRequest, group string) (*model.ReturnView, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	v, err := l.store.ReadReturns(ctx, r.GetUid(), userlogic.Hash(r.GetSid()), group, l.config, l.location, time.Now().UTC())
	if err != nil {
		return nil, xerr.Public(err)
	}
	return v, nil
}

func (l *Logic) RebateInfo(ctx context.Context, r *pb.ReturnRequest) (*pb.RebateInfoReply, error) {
	v, err := l.info(ctx, r, model.GroupRebate)
	if err != nil {
		return nil, err
	}
	out := &pb.RebateInfoReply{ActivityDate: v.Date, Timezone: l.location.String(), Daily: sectionReply(v.Sections[0]), Weekly: sectionReply(v.Sections[1]), Monthly: sectionReply(v.Sections[2]), ClaimableTotal: v.Total}
	providers := map[string]bool{}
	for _, g := range l.games.Games {
		if g.Enabled && g.Provider != "" {
			providers[g.Provider] = true
		}
	}
	names := []string{}
	for name := range providers {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		out.Platforms = append(out.Platforms, &pb.RebatePlatform{Name: name, DailyRateBps: l.config.DailyRateBps, WeeklyRateBps: l.config.WeeklyRateBps, MonthlyRateBps: l.config.MonthlyRateBps})
	}
	return out, nil
}

func (l *Logic) LoserReturnInfo(ctx context.Context, r *pb.ReturnRequest) (*pb.LoserReturnInfoReply, error) {
	v, err := l.info(ctx, r, model.GroupLoser)
	if err != nil {
		return nil, err
	}
	return &pb.LoserReturnInfoReply{ActivityDate: v.Date, Timezone: l.location.String(), Daily: sectionReply(v.Sections[0]), ClaimableTotal: v.Total}, nil
}

func (l *Logic) RebateClaim(ctx context.Context, r *pb.ReturnRequest) (*pb.ReturnClaimReply, error) {
	return l.claim(ctx, r, model.GroupRebate)
}

func (l *Logic) LoserReturnClaim(ctx context.Context, r *pb.ReturnRequest) (*pb.ReturnClaimReply, error) {
	return l.claim(ctx, r, model.GroupLoser)
}

func (l *Logic) claim(ctx context.Context, r *pb.ReturnRequest, group string) (*pb.ReturnClaimReply, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	if _, err := time.Parse(time.DateOnly, r.ActivityDate); err != nil {
		return nil, xerr.ErrInvalid
	}
	receipt, err := l.store.ClaimReturns(ctx, r.GetUid(), userlogic.Hash(r.GetSid()), group, r.ActivityDate, l.config, l.location, time.Now().UTC())
	if err != nil {
		return nil, xerr.Public(err)
	}
	out := &pb.ReturnClaimReply{ClaimId: receipt.Batch.ClaimID, ActivityDate: receipt.Batch.ClaimDate, TotalReward: receipt.Batch.TotalReward, Coins: receipt.Batch.Coins, Items: []*pb.ReturnPeriod{}}
	for _, item := range receipt.Items {
		available, _ := time.ParseInLocation(time.DateOnly, item.PeriodEnd, l.location)
		out.Items = append(out.Items, periodReply(&model.ReturnPeriod{LobbyReturnClaim: *item, Status: "claimed", AvailableAt: available, ExpiresAt: available.AddDate(0, 0, 1)}))
	}
	return out, nil
}

func sectionReply(s *model.ReturnSection) *pb.ReturnSection {
	return &pb.ReturnSection{Claim: periodReply(s.Claim), Preview: periodReply(s.Preview)}
}

func periodReply(p *model.ReturnPeriod) *pb.ReturnPeriod {
	loss := p.BetAmount - p.WinAmount
	if loss < 0 {
		loss = 0
	}
	return &pb.ReturnPeriod{Type: p.Kind, PeriodStart: p.PeriodStart, PeriodEnd: p.PeriodEnd, ValidBet: p.ValidBet, BetAmount: p.BetAmount, WinAmount: p.WinAmount, LossAmount: loss, BaseAmount: p.BaseAmount, RateBps: p.RateBps, Reward: p.Reward, Status: p.Status, AvailableAt: p.AvailableAt.Format(time.RFC3339), ExpiresAt: p.ExpiresAt.Format(time.RFC3339)}
}
