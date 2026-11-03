package agentservice

import (
	"context"
	"sort"
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

type Logic struct {
	store     repository.AgentStore
	users     repository.UserStore
	providers map[string]bool
	baseURL   string
}

func New(s *svc.ServiceContext) *Logic {
	p := map[string]bool{}
	for k := range s.Config.Agent.Providers {
		p[k] = true
	}
	return &Logic{s.Repo.Agent, s.Repo.Users, p, s.Config.Invite.BaseURL}
}

func (l *Logic) auth(ctx context.Context, r *pb.AgentRequest) error {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return xerr.ErrSession
	}
	return l.users.Check(ctx, r.GetUid(), userlogic.Hash(r.GetSid()), time.Now().UTC())
}

func (l *Logic) query(ctx context.Context, r *pb.AgentRequest, action string) (*pb.AgentReply, error) {
	if e := l.auth(ctx, r); e != nil {
		return nil, e
	}
	period := r.Period
	if period == "" {
		period = "today"
	}
	switch period {
	case "today", "yesterday", "this_week", "last_week", "this_month", "last_month":
	default:
		return nil, xerr.ErrInvalid
	}
	if r.Provider != "" && !l.providers[r.Provider] {
		return nil, xerr.ErrInvalid
	}
	if r.Scope != "" && r.Scope != "all" && r.Scope != "direct" && r.Scope != "other" {
		return nil, xerr.ErrInvalid
	}
	if r.TargetUid < 0 || r.Page < 0 || r.Page > 100000 || len(r.Search) > 64 || strings.ContainsFunc(r.Search, unicode.IsControl) {
		return nil, xerr.ErrInvalid
	}
	if action == "report-details" {
		switch r.Kind {
		case "team", "bets", "first-deposit", "deposit", "withdrawal":
		default:
			return nil, xerr.ErrInvalid
		}
	}
	page := int(r.Page)
	if page == 0 {
		page = 1
	}
	v, e := l.store.Query(ctx, model.AgentQuery{UID: r.GetUid(), TargetUID: r.TargetUid, Period: period, Provider: r.Provider, Scope: r.Scope, Search: strings.TrimSpace(r.Search), Kind: r.Kind, Page: page, Action: action}, time.Now().UTC())
	if e != nil {
		return nil, xerr.Public(e)
	}
	s := v.Summary
	out := &pb.AgentReply{Summary: &pb.AgentSummary{TeamCount: s.TeamCount, DirectCount: s.DirectCount, OtherCount: s.OtherCount, NewCount: s.NewCount, DirectNew: s.DirectNew, OtherNew: s.OtherNew, ValidBet: s.ValidBet, Commission: s.Commission, DirectCommission: s.DirectCommission, OtherCommission: s.OtherCommission, Claimable: s.Claimable, BetCount: s.BetCount, BettorCount: s.BettorCount, Profit: s.Profit, FirstDepositCount: s.FirstDepositCount, FirstDepositAmount: s.FirstDepositAmount, DepositCount: s.DepositCount, DepositAmount: s.DepositAmount, WithdrawalCount: s.WithdrawalCount, WithdrawalAmount: s.WithdrawalAmount}, Items: []*pb.AgentRow{}, HasMore: v.HasMore, From: v.From, To: v.To, Timezone: v.Timezone, Status: v.Status, UpdatedAt: v.UpdatedAt, Providers: v.Providers, Account: v.Account}
	sort.Strings(out.Providers)
	if v.InviteURL != "" {
		out.InviteUrl = model.AgentInviteURL(l.baseURL, v.InviteURL)
	}
	for _, r := range v.Items {
		out.Items = append(out.Items, &pb.AgentRow{Uid: r.UID, Account: r.Account, RegisteredAt: r.RegisteredAt, Depth: r.Depth, Children: r.Children, Provider: r.Provider, ValidBet: r.ValidBet, TeamBet: r.TeamBet, Commission: r.Commission, Profit: r.Profit, Amount: r.Amount, PaymentType: r.PaymentType, ClaimId: r.ClaimID, CreatedAt: r.CreatedAt, Threshold: r.Threshold, PerTenThousand: r.PerTenThousand})
	}
	return out, nil
}

func (l *Logic) AgentCenter(c context.Context, r *pb.AgentRequest) (*pb.AgentReply, error) {
	r.Period = "today"
	r.TargetUid = 0
	r.Search = ""
	return l.query(c, r, "center")
}

func (l *Logic) AgentTeam(c context.Context, r *pb.AgentRequest) (*pb.AgentReply, error) {
	return l.query(c, r, "team")
}

func (l *Logic) AgentPerformance(c context.Context, r *pb.AgentRequest) (*pb.AgentReply, error) {
	return l.query(c, r, "performance")
}

func (l *Logic) AgentPerformanceDetails(c context.Context, r *pb.AgentRequest) (*pb.AgentReply, error) {
	return l.query(c, r, "performance-details")
}

func (l *Logic) AgentReport(c context.Context, r *pb.AgentRequest) (*pb.AgentReply, error) {
	return l.query(c, r, "report")
}

func (l *Logic) AgentReportDetails(c context.Context, r *pb.AgentRequest) (*pb.AgentReply, error) {
	return l.query(c, r, "report-details")
}

func (l *Logic) AgentRates(c context.Context, r *pb.AgentRequest) (*pb.AgentReply, error) {
	return l.query(c, r, "rates")
}

func (l *Logic) AgentRecords(c context.Context, r *pb.AgentRequest) (*pb.AgentReply, error) {
	return l.query(c, r, "records")
}

func (l *Logic) AgentClaim(c context.Context, r *pb.AgentRequest) (*pb.AgentClaimReply, error) {
	if e := l.auth(c, r); e != nil {
		return nil, e
	}
	id := r.RequestId
	if id == "" || len(id) > 128 || strings.TrimSpace(id) != id || strings.ContainsFunc(id, unicode.IsControl) {
		return nil, xerr.ErrInvalid
	}
	v, e := l.store.Claim(c, r.GetUid(), id, time.Now().UTC())
	if e != nil {
		return nil, xerr.Public(e)
	}
	return &pb.AgentClaimReply{ClaimId: v.ClaimID, Amount: v.Amount, Coins: v.Coins, CreatedAt: v.CreatedAt.Format(time.RFC3339Nano)}, nil
}
