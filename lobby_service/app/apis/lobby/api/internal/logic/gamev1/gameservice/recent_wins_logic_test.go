package gameservice

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/manager/recentwins"
	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
)

type recentFake struct{ rows []model.RecentWinView }

func (s recentFake) ReadRecentWins(context.Context, []string, time.Time) ([]model.RecentWinView, error) {
	return s.rows, nil
}

func TestRecentWinsPublicPrivacySelfAndReplay(t *testing.T) {
	ctx := context.Background()
	now := time.Now().UTC().Add(-time.Second)
	calls := 0
	adapter := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Header.Get("Authorization") != "Bearer "+strings.Repeat("x", 32) {
			t.Error("service auth")
		}
		_, _ = w.Write([]byte(`{"data":{"betId":"secret-bet","shareToken":"` + strings.Repeat("s", 52) + `"}}`))
	}))
	defer adapter.Close()
	cfg := config.GameConfig{ServiceToken: strings.Repeat("x", 32), Games: map[string]config.GameEntry{"AG1": {Enabled: true, Name: "Game", NameEn: "Game", Cover: "/assets/test.png", APIURL: adapter.URL, URL: "https://game.example/"}}}
	feed := recentwins.New(recentFake{[]model.RecentWinView{{ID: "123", GameID: "AG1", BetID: "secret-bet", UID: 7, Nickname: "PrivateName", BetAmount: "2000000", AvatarID: 3, WinAmount: "100000000", Multiplier: "50", EndedAt: now}}}, cfg.Games)
	if err := feed.Refresh(ctx, now); err != nil {
		t.Fatal(err)
	}
	l := &Logic{recentWins: feed, users: recordUsers{}, config: cfg}
	out, e := l.GameRecentWins(ctx, &pb.GameRecentWinsRequest{})
	if e != nil || len(out.Items) != 1 || out.Items[0].IsSelf || out.Items[0].Nickname != "Pr***e" || out.Items[0].BetId != "secret-bet" || out.Items[0].BetAmount != "2000000" || out.Items[0].AvatarId != 3 {
		t.Fatal(out, e)
	}
	uid := int64(7)
	sid := strings.Repeat("s", 52)
	out, e = l.GameRecentWins(ctx, &pb.GameRecentWinsRequest{Uid: &uid, Sid: &sid})
	if e != nil || !out.Items[0].IsSelf {
		t.Fatal(out, e)
	}
	if _, e = l.GameRecentWins(ctx, &pb.GameRecentWinsRequest{Uid: &uid}); !errors.Is(e, xerr.ErrSession) {
		t.Fatal(e)
	}
	l.users = recordUsers{err: xerr.ErrSession}
	if _, e = l.GameRecentWins(ctx, &pb.GameRecentWinsRequest{Uid: &uid, Sid: &sid}); e == nil {
		t.Fatal("invalid session")
	}
	replay, e := l.GameRecentWinReplay(ctx, &pb.GameRecentWinReplayRequest{Id: "123"})
	if e != nil || !strings.Contains(replay.ReplayUrl, "replay=secret-bet") || strings.Contains(replay.ReplayUrl, "launchTicket") {
		t.Fatal(replay, e)
	}
	for _, id := range []string{"124", "-1", "abc", "0123"} {
		if _, e = l.GameRecentWinReplay(ctx, &pb.GameRecentWinReplayRequest{Id: id}); e == nil {
			t.Fatal("unknown order", id)
		}
	}
	if calls != 1 {
		t.Fatal(calls)
	}
	l.recentWins = nil
	if _, e = l.GameRecentWins(ctx, &pb.GameRecentWinsRequest{}); e == nil {
		t.Fatal("missing feed")
	}
	if _, e = l.GameRecentWinReplay(ctx, &pb.GameRecentWinReplayRequest{Id: "123"}); e == nil {
		t.Fatal("missing feed")
	}
	empty := recentwins.New(recentFake{}, cfg.Games)
	l.recentWins = empty
	if _, e = l.GameRecentWins(ctx, &pb.GameRecentWinsRequest{}); e == nil {
		t.Fatal("uninitialized snapshot")
	}
	for _, in := range []string{"", "a", "ab", "中文名字"} {
		if maskWinNickname(in) == in {
			t.Fatal("unmasked nickname", in)
		}
	}
}
