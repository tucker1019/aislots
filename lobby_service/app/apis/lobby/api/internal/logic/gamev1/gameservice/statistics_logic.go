package gameservice

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"sync"
	"time"

	user "apps/app/apis/lobby/api/internal/logic/userv1/userservice"
	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"

	"google.golang.org/protobuf/proto"
)

type statisticsStore interface {
	CompleteGame(context.Context, model.GameCompletion) (bool, error)
	ReadRTP(context.Context, string, int, time.Time) (model.RTPView, error)
	ReadLeaderboard(context.Context, string, string, string, time.Time) ([]model.RankView, time.Time, error)
}
type cachedStatistics struct {
	until time.Time
	data  proto.Message
}
type statisticsCache struct {
	mu      sync.Mutex
	entries map[string]cachedStatistics
}

func newStatisticsCache() *statisticsCache {
	return &statisticsCache{entries: map[string]cachedStatistics{}}
}

func cachedStats[T proto.Message](cache *statisticsCache, key string, read func() (T, error)) (T, error) {
	if cache == nil {
		return read()
	}
	cache.mu.Lock()
	defer cache.mu.Unlock()
	now := time.Now()
	if row, ok := cache.entries[key]; ok && now.Before(row.until) {
		return proto.Clone(row.data).(T), nil
	}
	out, e := read()
	if e == nil {
		if len(cache.entries) > 512 {
			for k, v := range cache.entries {
				if !now.Before(v.until) {
					delete(cache.entries, k)
				}
			}
		}
		cache.entries[key] = cachedStatistics{now.Add(15 * time.Second), proto.Clone(out)}
	}
	return out, e
}

func (l *Logic) statisticsAuth(ctx context.Context, r *pb.GameStatisticsRequest) (statisticsStore, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	if e := l.users.Check(ctx, r.GetUid(), user.Hash(r.GetSid()), time.Now().UTC()); e != nil {
		return nil, xerr.Public(e)
	}
	if _, ok := l.config.Games[r.GameId]; !ok {
		return nil, xerr.ErrInvalid
	}
	store, ok := l.store.(statisticsStore)
	if !ok {
		return nil, xerr.ErrInvalid
	}
	return store, nil
}

func (l *Logic) GameComplete(ctx context.Context, r *pb.GameCompleteRequest) (*pb.GameCompleteReply, error) {
	if _, ok := l.config.Games[r.GameId]; !ok || r.Uid <= 0 || r.BetId == "" || len(r.BetId) > 128 || r.Sequence < 1 || r.BetAmount < 1 || r.WinAmount < 0 {
		return nil, xerr.ErrInvalid
	}
	started, e := time.Parse(time.RFC3339Nano, r.StartedAt)
	if e != nil {
		return nil, xerr.ErrInvalid
	}
	ended, e := time.Parse(time.RFC3339Nano, r.EndedAt)
	if e != nil || ended.Before(started) || ended.After(time.Now().Add(2*time.Minute)) {
		return nil, xerr.ErrInvalid
	}
	store, ok := l.store.(statisticsStore)
	if !ok {
		return nil, xerr.ErrInvalid
	}
	included, e := store.CompleteGame(ctx, model.GameCompletion{UID: r.Uid, GameID: r.GameId, BetID: r.BetId, Sequence: r.Sequence, BetAmount: r.BetAmount, WinAmount: r.WinAmount, StartedAt: started.UTC().Truncate(time.Microsecond), EndedAt: ended.UTC().Truncate(time.Microsecond)})
	if e != nil {
		return nil, e
	}
	return &pb.GameCompleteReply{Included: included}, nil
}

func (l *Logic) GameRtp(ctx context.Context, r *pb.GameStatisticsRequest) (*pb.GameRtpReply, error) {
	store, e := l.statisticsAuth(ctx, r)
	if e != nil {
		return nil, e
	}
	minutes := map[string]int{"5m": 5, "1h": 60, "24h": 1440}[r.Window]
	if minutes == 0 {
		return nil, xerr.ErrInvalid
	}
	return cachedStats(l.stats, "rtp:"+r.GameId+":"+r.Window, func() (*pb.GameRtpReply, error) {
		now := time.Now().UTC()
		v, e := store.ReadRTP(ctx, r.GameId, minutes, now)
		if e != nil {
			return nil, e
		}
		return &pb.GameRtpReply{GameId: r.GameId, From: v.From.Format(time.RFC3339), To: v.To.Format(time.RFC3339), UpdatedAt: now.Format(time.RFC3339), StatisticsSince: v.Since.Format(time.RFC3339), BetAmount: v.BetAmount, WinAmount: v.WinAmount, Rounds: v.Rounds, HasData: v.HasData, Percent: v.Percent}, nil
	})
}

func (l *Logic) GameLeaderboard(ctx context.Context, r *pb.GameStatisticsRequest) (*pb.GameLeaderboardReply, error) {
	store, e := l.statisticsAuth(ctx, r)
	if e != nil {
		return nil, e
	}
	if r.Board != "wins" && r.Board != "multiplier" && r.Board != "streak" || r.Period != "today" && r.Period != "week" && r.Period != "all" {
		return nil, xerr.ErrInvalid
	}
	return cachedStats(l.stats, "rank:"+r.GameId+":"+r.Board+":"+r.Period, func() (*pb.GameLeaderboardReply, error) {
		now := time.Now().UTC()
		rows, since, e := store.ReadLeaderboard(ctx, r.GameId, r.Board, r.Period, now)
		if e != nil {
			return nil, e
		}
		zone := "UTC"
		if l.location != nil {
			zone = l.location.String()
		}
		out := &pb.GameLeaderboardReply{Items: []*pb.GameLeaderboardItem{}, UpdatedAt: now.Format(time.RFC3339), StatisticsSince: since.Format(time.RFC3339), Timezone: zone}
		for i, row := range rows {
			mac := hmac.New(sha256.New, []byte(l.config.ServiceToken))
			_, _ = mac.Write([]byte(strconv.FormatInt(row.UID, 10)))
			out.Items = append(out.Items, &pb.GameLeaderboardItem{PlatformOrderId: row.PlatformOrderID, Rank: int32(i + 1), UserId: hex.EncodeToString(mac.Sum(nil))[:20], Nickname: row.Nickname, AvatarId: row.AvatarID, BetId: row.BetID, BetAmount: row.BetAmount, WinAmount: row.WinAmount, Multiplier: row.Multiplier, Streak: row.Streak, OccurredAt: row.EndedAt.Format(time.RFC3339)})
		}
		return out, nil
	})
}
