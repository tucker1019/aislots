package gameservice

import (
	user "apps/app/apis/lobby/api/internal/logic/userv1/userservice"
	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
	"context"
	"fmt"
	"time"
)

type platformRankStore interface {
	ReadPlatformLeaderboard(context.Context, string, string, time.Time) ([]model.PlatformLeaderboardView, error)
	EnsurePlatformLeaderboardRewards(context.Context, time.Time, string, []int64) error
	ReadPlatformRewardStatuses(context.Context, time.Time, string) (map[int]string, error)
	ClaimPlatformLeaderboardReward(context.Context, int64, time.Time, string, int, bool, time.Time) (*model.PlatformRewardReceipt, error)
}
type participationStore interface {
	LeaderboardParticipation(context.Context, int64) (bool, error)
	SetLeaderboardParticipation(context.Context, int64, bool) error
}

func (l *Logic) PlatformLeaderboard(ctx context.Context, r *pb.PlatformLeaderboardRequest) (*pb.PlatformLeaderboardReply, error) {
	if r.Board != "wins" && r.Board != "multiplier" || r.Period != "today" && r.Period != "yesterday" {
		return nil, xerr.ErrInvalid
	}
	store, ok := l.store.(platformRankStore)
	if !ok {
		return nil, xerr.ErrInvalid
	}
	var participating bool = true
	if r.GetUid() > 0 || r.GetSid() != "" {
		if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
			return nil, xerr.ErrSession
		}
		if e := l.users.Check(ctx, r.GetUid(), user.Hash(r.GetSid()), time.Now().UTC()); e != nil {
			return nil, xerr.Public(e)
		}
		if s, ok := l.users.(interface {
			LeaderboardParticipation(context.Context, int64) (bool, error)
		}); ok {
			participating, _ = s.LeaderboardParticipation(ctx, r.GetUid())
		}
	}
	rows, e := store.ReadPlatformLeaderboard(ctx, r.Board, r.Period, time.Now().UTC())
	if e != nil {
		return nil, e
	}
	statuses := map[int]string{}
	if r.Period == "yesterday" {
		day := time.Now().In(l.location).AddDate(0, 0, -1)
		if e = store.EnsurePlatformLeaderboardRewards(ctx, day, r.Board, l.leaderboardConfig.Rewards); e != nil {
			return nil, e
		}
		statuses, e = store.ReadPlatformRewardStatuses(ctx, day, r.Board)
		if e != nil {
			return nil, e
		}
	}
	rewards := make([]string, len(l.leaderboardConfig.Rewards))
	for i, v := range l.leaderboardConfig.Rewards {
		rewards[i] = fmt.Sprintf("%d", v)
	}
	out := &pb.PlatformLeaderboardReply{Items: []*pb.PlatformLeaderboardItem{}, UpdatedAt: time.Now().UTC().Format(time.RFC3339), Timezone: l.location.String(), Participating: participating, Rewards: rewards}
	for i, row := range rows {
		nick, uid := row.Nickname, ""
		if row.Anonymous {
			nick = "匿名"
			uid = "******"
		} else {
			uid = fmt.Sprintf("%d", row.UID)
		}
		g := l.config.Games[row.GameID]
		status := statuses[i+1]
		claimable := r.GetUid() > 0 && !row.Anonymous && status == "claimable" && fmt.Sprintf("%d", row.UID) == fmt.Sprintf("%d", r.GetUid())
		rewardAmount := rewards[i]
		if row.Anonymous || status == "ineligible" {
			rewardAmount = "0"
		}
		out.Items = append(out.Items, &pb.PlatformLeaderboardItem{Rank: int32(i + 1), Uid: uid, Nickname: nick, AvatarId: row.AvatarID, GameId: row.GameID, GameName: g.Name, GameNameEn: g.NameEn, BetId: row.BetID, BetAmount: row.BetAmount, WinAmount: row.WinAmount, Multiplier: row.Multiplier, OccurredAt: row.EndedAt.Format(time.RFC3339), RewardAmount: rewardAmount, Anonymous: row.Anonymous, PlatformOrderId: row.PlatformOrderID, Cover: g.Cover, RewardStatus: status, Claimable: claimable})
	}
	return out, nil
}

func (l *Logic) PlatformLeaderboardClaim(ctx context.Context, r *pb.PlatformLeaderboardClaimRequest) (*pb.PlatformLeaderboardClaimReply, error) {
	if r.Uid <= 0 || len(r.Sid) != 52 || r.Board != "wins" && r.Board != "multiplier" || r.Rank < 1 || r.Rank > 10 {
		return nil, xerr.ErrInvalid
	}
	if e := l.users.Check(ctx, r.Uid, user.Hash(r.Sid), time.Now().UTC()); e != nil {
		return nil, xerr.Public(e)
	}
	date, e := time.ParseInLocation(time.DateOnly, r.Date, l.location)
	if e != nil {
		return nil, xerr.ErrInvalid
	}
	nowLocal := time.Now().In(l.location)
	today := time.Date(nowLocal.Year(), nowLocal.Month(), nowLocal.Day(), 0, 0, 0, 0, l.location)
	if !date.Before(today) {
		return nil, xerr.ErrInvalid
	}
	store, ok := l.store.(platformRankStore)
	if !ok {
		return nil, xerr.ErrInvalid
	}
	if e = store.EnsurePlatformLeaderboardRewards(ctx, date, r.Board, l.leaderboardConfig.Rewards); e != nil {
		return nil, e
	}
	receipt, e := store.ClaimPlatformLeaderboardReward(ctx, r.Uid, date, r.Board, int(r.Rank), l.leaderboardConfig.Turnover, time.Now().UTC())
	if e != nil {
		return nil, e
	}
	return &pb.PlatformLeaderboardClaimReply{ClaimId: receipt.ClaimID, Amount: receipt.Amount, Coins: receipt.Coins, Status: receipt.Status}, nil
}
func (l *Logic) PlatformLeaderboardParticipation(ctx context.Context, r *pb.PlatformLeaderboardParticipationRequest) (*pb.PlatformLeaderboardParticipationReply, error) {
	if r.Uid <= 0 || len(r.Sid) != 52 {
		return nil, xerr.ErrSession
	}
	if e := l.users.Check(ctx, r.Uid, user.Hash(r.Sid), time.Now().UTC()); e != nil {
		return nil, xerr.Public(e)
	}
	s, ok := l.users.(participationStore)
	if !ok {
		return nil, xerr.ErrInvalid
	}
	if r.Participating != nil {
		if e := s.SetLeaderboardParticipation(ctx, r.Uid, r.GetParticipating()); e != nil {
			return nil, e
		}
	}
	v, e := s.LeaderboardParticipation(ctx, r.Uid)
	return &pb.PlatformLeaderboardParticipationReply{Participating: v}, e
}
