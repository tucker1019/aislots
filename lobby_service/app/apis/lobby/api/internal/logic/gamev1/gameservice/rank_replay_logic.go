package gameservice

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	user "apps/app/apis/lobby/api/internal/logic/userv1/userservice"
	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
)

func (l *Logic) GameRankReplay(ctx context.Context, r *pb.GameRankReplayRequest) (*pb.GameRankReplayReply, error) {
	if r.Board != "wins" && r.Board != "multiplier" || r.Period != "today" && r.Period != "week" && r.Period != "all" {
		return nil, xerr.ErrInvalid
	}
	id, err := strconv.ParseInt(r.PlatformOrderId, 10, 64)
	if err != nil || id <= 0 {
		return nil, xerr.ErrInvalid
	}
	if r.Uid <= 0 || len(r.Sid) != 52 {
		return nil, xerr.ErrSession
	}
	if err := l.users.Check(ctx, r.Uid, user.Hash(r.Sid), time.Now().UTC()); err != nil {
		return nil, xerr.Public(err)
	}
	if _, ok := l.config.Games[r.GameId]; !ok {
		return nil, xerr.ErrInvalid
	}
	durable, ok := l.store.(interface {
		ReadReplayOrderForGame(context.Context, int64, string) (model.ReplayOrder, bool, error)
	})
	if !ok {
		return nil, xerr.ErrInvalid
	}
	row, exists, err := durable.ReadReplayOrderForGame(ctx, id, r.GameId)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, xerr.ErrInvalid
	}
	return l.replayGameBet(ctx, row.GameID, row.UID, row.BetID)
}

func (l *Logic) replayGameBet(ctx context.Context, gameID string, uid int64, betID string) (*pb.GameRankReplayReply, error) {
	g := l.config.Games[gameID]
	if g.APIURL == "" || len(l.config.ServiceToken) < 32 {
		return nil, xerr.ErrInvalid
	}
	raw, err := json.Marshal(struct {
		UID    int64  `json:"uid"`
		GameID string `json:"gameId"`
		BetID  string `json:"betId"`
	}{uid, gameID, betID})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(g.APIURL, "/")+"/internal/rank-replay", bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+l.config.ServiceToken)
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{Timeout: 5 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	res, err := client.Do(req)
	if err != nil {
		return nil, xerr.ErrInvalid
	}
	defer func() { _ = res.Body.Close() }()
	var out struct {
		Data struct {
			BetID      string `json:"betId"`
			ShareToken string `json:"shareToken"`
		} `json:"data"`
	}
	if res.StatusCode != http.StatusOK || json.NewDecoder(io.LimitReader(res.Body, 4096)).Decode(&out) != nil || out.Data.BetID != betID || len(out.Data.ShareToken) != 52 {
		return nil, xerr.ErrInvalid
	}
	u, err := url.Parse(g.URL)
	if err != nil || u.Host == "" {
		return nil, xerr.ErrInvalid
	}
	q := u.Query()
	q.Set("replay", betID)
	q.Set("share", out.Data.ShareToken)
	u.RawQuery = q.Encode()
	return &pb.GameRankReplayReply{ReplayUrl: u.String()}, nil
}
