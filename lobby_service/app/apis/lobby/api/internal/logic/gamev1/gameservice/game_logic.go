package gameservice

import (
	"context"
	"crypto/rand"
	"net/url"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	user "apps/app/apis/lobby/api/internal/logic/userv1/userservice"
	"apps/app/apis/lobby/api/internal/repository"
	"apps/app/apis/lobby/api/internal/repository/model"
	"apps/app/apis/lobby/api/internal/svc"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
)

type Logic struct {
	invite       inviteStore
	inviteConfig config.InviteConfig
	location     *time.Location
	stats        *statisticsCache
	users        repository.UserStore
	store        repository.GameStore
	config       config.GameConfig
}

func New(s *svc.ServiceContext) *Logic {
	var invites inviteStore
	if s.Repo.Invite != nil {
		invites = s.Repo.Invite
	}
	return &Logic{invite: invites, inviteConfig: s.Config.Invite, store: s.Repo.Game, config: s.Config.Game, users: s.Repo.Users, stats: newStatisticsCache(), location: s.Config.Checkin.Location()}
}

func (l *Logic) GameLaunch(ctx context.Context, r *pb.GameLaunchRequest) (*pb.GameLaunchReply, error) {
	g, ok := l.config.Games[r.GameId]
	if !ok || !g.Enabled || !g.IsVisible() || len(l.config.ServiceToken) < 32 {
		return nil, xerr.ErrInvalid
	}
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	ticket := rand.Text() + rand.Text()
	expires := time.Now().UTC().Add(time.Minute)
	if e := l.store.Issue(ctx, r.GetUid(), user.Hash(r.GetSid()), user.Hash(ticket), r.GameId, expires); e != nil {
		return nil, e
	}
	u, _ := url.Parse(g.URL)
	q := u.Query()
	q.Set("launchTicket", ticket)
	u.RawQuery = q.Encode()
	return &pb.GameLaunchReply{LaunchUrl: u.String(), ExpiresAt: expires.Format(time.RFC3339Nano)}, nil
}

func (l *Logic) GameExchange(ctx context.Context, r *pb.GameExchangeRequest) (*pb.GameIdentityReply, error) {
	if len(r.LaunchTicket) != 52 || len(r.ExchangeId) < 16 || len(r.ExchangeId) > 128 {
		return nil, xerr.ErrGameTicket
	}
	if g, ok := l.config.Games[r.GameId]; !ok || !g.Enabled || !g.IsVisible() {
		return nil, xerr.ErrGameTicket
	}
	uid, e := l.store.Exchange(ctx, user.Hash(r.LaunchTicket), r.ExchangeId, r.GameId, time.Now().UTC())
	if e != nil {
		return nil, e
	}
	coins, e := l.store.Balance(ctx, uid)
	if e != nil {
		return nil, e
	}
	return &pb.GameIdentityReply{Uid: uid, Appname: l.config.AppName, Appkey: l.config.AppKey, Country: l.config.Country, Currency: l.config.Currency, Coins: coins}, nil
}

func (l *Logic) GameBalance(ctx context.Context, r *pb.GameBalanceRequest) (*pb.GameBalanceReply, error) {
	if _, ok := l.config.Games[r.GameId]; !ok || r.Uid <= 0 {
		return nil, xerr.ErrInvalid
	}
	n, e := l.store.Balance(ctx, r.Uid)
	return &pb.GameBalanceReply{Coins: n}, e
}

func (l *Logic) GameSettle(ctx context.Context, r *pb.GameSettleRequest) (*pb.GameSettleReply, error) {
	if _, ok := l.config.Games[r.GameId]; !ok || r.Uid <= 0 || r.RequestId == "" || len(r.RequestId) > 128 || r.BetId == "" || len(r.BetId) > 128 || r.Debit < 0 || r.Credit < 0 || r.Debit == 0 && r.Credit == 0 {
		return nil, xerr.ErrInvalid
	}
	out, e := l.store.Settle(ctx, &model.LobbyGameSettlement{RequestID: r.RequestId, UID: r.Uid, GameID: r.GameId, BetID: r.BetId, Debit: r.Debit, Credit: r.Credit}, time.Now().UTC())
	if e != nil {
		return nil, e
	}
	return &pb.GameSettleReply{Status: out.Status, Coins: out.Coins}, nil
}
