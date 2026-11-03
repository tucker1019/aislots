package gameservice

import (
	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

type statsFake struct {
	fake
	reads   int
	err     error
	minutes int
}

func (f *statsFake) CompleteGame(context.Context, model.GameCompletion) (bool, error) {
	return true, f.err
}
func (f *statsFake) ReadRTP(_ context.Context, _ string, minutes int, now time.Time) (model.RTPView, error) {
	f.reads++
	f.minutes = minutes
	return model.RTPView{From: now.Add(-time.Hour), To: now, Since: now, BetAmount: "100", WinAmount: "200", Percent: "200.00", Rounds: 1, HasData: true}, f.err
}
func (f *statsFake) ReadLeaderboard(context.Context, string, string, string, time.Time) ([]model.RankView, time.Time, error) {
	f.reads++
	return []model.RankView{{PlatformOrderID: "123", UID: 7, Nickname: "Private Account", AvatarID: 2, BetID: "bet", BetAmount: "100", WinAmount: "200", Multiplier: "2.00", Streak: 3, EndedAt: time.Now()}}, time.Now(), f.err
}
func TestStatisticsAPIAuthCachePrivacyAndValidation(t *testing.T) {
	ctx := context.Background()
	uid := int64(7)
	sid := strings.Repeat("s", 52)
	f := &statsFake{}
	l := &Logic{store: f, users: recordUsers{}, config: config.GameConfig{ServiceToken: strings.Repeat("x", 32), Games: map[string]config.GameEntry{"AG1": {Enabled: true}}}, stats: newStatisticsCache(), location: time.UTC}
	r := &pb.GameStatisticsRequest{Uid: &uid, Sid: &sid, GameId: "AG1", Window: "5m", Board: "wins", Period: "today"}
	out, e := l.GameRtp(ctx, r)
	if e != nil || !out.HasData || f.minutes != 5 {
		t.Fatal(out, e)
	}
	out.Percent = "mutated"
	out, e = l.GameRtp(ctx, r)
	if e != nil || out.Percent != "200.00" || f.reads != 1 {
		t.Fatal("cache mutation", out, e)
	}
	rank, e := l.GameLeaderboard(ctx, r)
	if e != nil || rank.Items[0].Nickname != "P***" || rank.Items[0].UserId == "7" || len(rank.Items[0].UserId) != 20 {
		t.Fatal(rank, e)
	}
	if _, e = l.GameLeaderboard(ctx, r); e != nil {
		t.Fatal(e)
	}
	r.Window = "invalid"
	if _, e = l.GameRtp(ctx, r); e == nil {
		t.Fatal("window")
	}
	r.Board = "invalid"
	if _, e = l.GameLeaderboard(ctx, r); e == nil {
		t.Fatal("board")
	}
	if _, e = l.GameRtp(ctx, &pb.GameStatisticsRequest{}); !errors.Is(e, xerr.ErrSession) {
		t.Fatal(e)
	}
	l.users = recordUsers{err: xerr.ErrSession}
	if _, e = l.GameRtp(ctx, r); e == nil {
		t.Fatal("session")
	}
	l.users = recordUsers{}
	r.GameId = "other"
	if _, e = l.GameRtp(ctx, r); e == nil {
		t.Fatal("game")
	}
	r.GameId = "AG1"
	complete := &pb.GameCompleteRequest{Uid: uid, GameId: "AG1", BetId: "b", Sequence: 1, BetAmount: 100, WinAmount: 20, StartedAt: time.Now().Add(-time.Minute).UTC().Format(time.RFC3339Nano), EndedAt: time.Now().UTC().Format(time.RFC3339Nano)}
	if v, e := l.GameComplete(ctx, complete); e != nil || !v.Included {
		t.Fatal(v, e)
	}
	if _, e = l.GameComplete(ctx, &pb.GameCompleteRequest{}); e == nil {
		t.Fatal("invalid event")
	}
	started := complete.StartedAt
	complete.StartedAt = "bad"
	if _, e = l.GameComplete(ctx, complete); e == nil {
		t.Fatal("start")
	}
	complete.StartedAt = started
	complete.EndedAt = "bad"
	if _, e = l.GameComplete(ctx, complete); e == nil {
		t.Fatal("end")
	}
	complete.EndedAt = time.Now().UTC().Format(time.RFC3339Nano)
	f.err = errors.New("db")
	if _, e = l.GameComplete(ctx, complete); e == nil {
		t.Fatal("db")
	}
	l.stats = nil
	r.Window = "24h"
	if _, e = l.GameRtp(ctx, r); e == nil {
		t.Fatal("db")
	}
	r.Board = "streak"
	if _, e = l.GameLeaderboard(ctx, r); e == nil {
		t.Fatal("db")
	}
	l.store = &fake{}
	if _, e = l.GameComplete(ctx, complete); e == nil {
		t.Fatal("store")
	}
	if _, e = l.GameRtp(ctx, r); e == nil {
		t.Fatal("store")
	}
}
