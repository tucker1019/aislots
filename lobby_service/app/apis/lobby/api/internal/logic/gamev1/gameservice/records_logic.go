package gameservice

import (
	user "apps/app/apis/lobby/api/internal/logic/userv1/userservice"
	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
	"context"
	"sort"
	"time"
)

type recordStore interface {
	Records(context.Context, int64, time.Time, time.Time, int, []string) ([]model.GameRecordRow, model.GameRecordSummary, error)
}

func (l *Logic) GameRecords(ctx context.Context, r *pb.GameRecordsRequest) (*pb.GameRecordsReply, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	if e := l.users.Check(ctx, r.GetUid(), user.Hash(r.GetSid()), time.Now().UTC()); e != nil {
		return nil, xerr.Public(e)
	}
	from, e := time.Parse(time.RFC3339, r.From)
	if e != nil {
		return nil, xerr.ErrInvalid
	}
	to, e := time.Parse(time.RFC3339, r.To)
	if e != nil || !to.After(from) || to.Sub(from) > 8*24*time.Hour || r.Page < 1 || r.Page > 10000 {
		return nil, xerr.ErrInvalid
	}
	store, ok := l.store.(recordStore)
	if !ok {
		return nil, xerr.ErrInvalid
	}
	var gameIDs []string
	if r.Provider != "" {
		for id, g := range l.config.Games {
			if g.Provider == r.Provider {
				gameIDs = append(gameIDs, id)
			}
		}
		if len(gameIDs) == 0 {
			return nil, xerr.ErrInvalid
		}
	}
	rows, sum, e := store.Records(ctx, r.GetUid(), from, to, int(r.Page), gameIDs)
	if e != nil {
		return nil, e
	}
	out := &pb.GameRecordsReply{Items: []*pb.GameRecord{}, Count: sum.Count, BetAmount: sum.BetAmount, Profit: sum.Profit, Currency: l.config.Currency, HasMore: len(rows) > 20}
	providers := map[string]bool{}
	for _, g := range l.config.Games {
		if g.Provider != "" {
			providers[g.Provider] = true
		}
	}
	for p := range providers {
		out.Providers = append(out.Providers, p)
	}
	sort.Strings(out.Providers)
	if len(rows) > 20 {
		rows = rows[:20]
	}
	for _, r := range rows {
		g := l.config.Games[r.GameID]
		out.Items = append(out.Items, &pb.GameRecord{BetId: r.BetID, GameId: r.GameID, GameName: g.Name, Provider: g.Provider, CreatedAt: r.CreatedAt.UTC().Format(time.RFC3339Nano), BetAmount: r.BetAmount, ValidBet: r.BetAmount, Profit: r.Profit})
	}
	return out, nil
}
