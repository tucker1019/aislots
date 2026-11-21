package gameservice

import (
	"context"
	"strconv"
	"time"

	user "apps/app/apis/lobby/api/internal/logic/userv1/userservice"
	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
)

func (l *Logic) GameRecentWins(ctx context.Context, r *pb.GameRecentWinsRequest) (*pb.GameRecentWinsReply, error) {
	uid := r.GetUid()
	if uid != 0 || r.GetSid() != "" {
		if uid <= 0 || len(r.GetSid()) != 52 {
			return nil, xerr.ErrSession
		}
		if err := l.users.Check(ctx, uid, user.Hash(r.GetSid()), time.Now().UTC()); err != nil {
			return nil, xerr.Public(err)
		}
	}
	if l.recentWins == nil {
		return nil, xerr.ErrInvalid
	}
	now := time.Now().UTC()
	rows, updated := l.recentWins.Snapshot(now)
	if updated.IsZero() {
		return nil, xerr.ErrInvalid
	}
	out := &pb.GameRecentWinsReply{Items: []*pb.GameRecentWin{}, UpdatedAt: updated.Format(time.RFC3339Nano)}
	for _, row := range rows {
		g, ok := l.config.Games[row.GameID]
		if !ok || !g.Enabled || !g.IsVisible() {
			continue
		}
		nickname, playerUID := row.Nickname, strconv.FormatInt(row.UID, 10)
		if row.Anonymous {
			nickname, playerUID = "匿名", "******"
		}
		out.Items = append(out.Items, &pb.GameRecentWin{Id: row.ID, BetId: row.BetID, BetAmount: row.BetAmount, AvatarId: row.AvatarID, GameId: row.GameID, GameName: g.Name, GameNameEn: g.NameEn, Cover: g.Cover, Nickname: nickname, WinAmount: row.WinAmount, Multiplier: row.Multiplier, OccurredAt: row.EndedAt.Format(time.RFC3339Nano), IsSelf: uid > 0 && uid == row.UID, Uid: playerUID, Anonymous: row.Anonymous})
	}
	return out, nil
}

// A public replay is authorized by membership in a server-published snapshot, not a client-supplied player/bet.
func (l *Logic) GameRecentWinReplay(ctx context.Context, r *pb.GameRecentWinReplayRequest) (*pb.GameRankReplayReply, error) {
	id, err := strconv.ParseInt(r.Id, 10, 64)
	if err != nil || id <= 0 || strconv.FormatInt(id, 10) != r.Id {
		return nil, xerr.ErrInvalid
	}
	store, ok := l.store.(interface {
		ReadReplayOrder(context.Context, int64) (model.ReplayOrder, bool, error)
	})
	if !ok {
		return nil, xerr.ErrInvalid
	}
	row, exists, err := store.ReadReplayOrder(ctx, id)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, xerr.ErrInvalid
	}
	g, ok := l.config.Games[row.GameID]
	if !ok || !g.Enabled || !g.IsVisible() {
		return nil, xerr.ErrInvalid
	}
	return l.replayGameBet(ctx, row.GameID, row.UID, row.BetID)
}
