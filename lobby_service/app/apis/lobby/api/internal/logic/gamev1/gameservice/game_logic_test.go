package gameservice

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
)

type fake struct {
	err  error
	hash string
}

func (f *fake) Issue(_ context.Context, _ int64, _, hash, _ string, _ time.Time) error {
	f.hash = hash
	return f.err
}

func (f *fake) Exchange(context.Context, string, string, string, time.Time) (int64, error) {
	return 1, f.err
}
func (f *fake) Balance(context.Context, int64) (int64, error) { return 123, f.err }
func (f *fake) Settle(_ context.Context, in *model.LobbyGameSettlement, _ time.Time) (*model.LobbyGameSettlement, error) {
	in.Status = "confirmed"
	in.Coins = 100
	return in, f.err
}

func TestLaunchAndInternalLogic(t *testing.T) {
	ctx := context.Background()
	f := &fake{}
	l := &Logic{store: f, config: config.GameConfig{AppName: "lobby", AppKey: "web", Country: "ID", Currency: "IDR", ServiceToken: strings.Repeat("s", 32), Games: map[string]config.GameEntry{"AG1": {Enabled: true, URL: "https://game.example/AG1/"}}}}
	uid := int64(1)
	sid := strings.Repeat("x", 52)
	launch, e := l.GameLaunch(ctx, &pb.GameLaunchRequest{Uid: &uid, Sid: &sid, GameId: "AG1"})
	if e != nil {
		t.Fatal(e)
	}
	u, _ := url.Parse(launch.LaunchUrl)
	if len(u.Query().Get("launchTicket")) != 52 || strings.Contains(launch.LaunchUrl, sid) || f.hash == u.Query().Get("launchTicket") {
		t.Fatal("leaked session or unhashed token")
	}
	if _, e = l.GameLaunch(ctx, &pb.GameLaunchRequest{GameId: "AG1"}); !errors.Is(e, xerr.ErrSession) {
		t.Fatal(e)
	}
	if _, e = l.GameLaunch(ctx, &pb.GameLaunchRequest{GameId: "other"}); e == nil {
		t.Fatal("unknown game")
	}
	req := &pb.GameExchangeRequest{GameId: "AG1", LaunchTicket: strings.Repeat("a", 52), ExchangeId: strings.Repeat("b", 16)}
	v, e := l.GameExchange(ctx, req)
	if e != nil || v.Coins != 123 || v.Uid != 1 {
		t.Fatal(v, e)
	}
	req.LaunchTicket = "bad"
	if _, e = l.GameExchange(ctx, req); e == nil {
		t.Fatal("bad ticket")
	}
	if _, e = l.GameBalance(ctx, &pb.GameBalanceRequest{Uid: 1, GameId: "AG1"}); e != nil {
		t.Fatal(e)
	}
	if _, e = l.GameBalance(ctx, &pb.GameBalanceRequest{}); e == nil {
		t.Fatal("bad balance request")
	}
	settle := &pb.GameSettleRequest{Uid: 1, GameId: "AG1", BetId: "bet", RequestId: "step", Debit: 100}
	if v, e := l.GameSettle(ctx, settle); e != nil || v.Status != "confirmed" {
		t.Fatal(v, e)
	}
	settle.Debit = -1
	if _, e = l.GameSettle(ctx, settle); e == nil {
		t.Fatal("negative debit")
	}
	f.err = errors.New("offline")
	if _, e = l.GameLaunch(ctx, &pb.GameLaunchRequest{Uid: &uid, Sid: &sid, GameId: "AG1"}); e == nil {
		t.Fatal("swallowed issue failure")
	}
	req.LaunchTicket = strings.Repeat("a", 52)
	if _, e = l.GameExchange(ctx, req); e == nil {
		t.Fatal("swallowed exchange failure")
	}
	settle.Debit = 100
	if _, e = l.GameSettle(ctx, settle); e == nil {
		t.Fatal("swallowed settlement failure")
	}
}
