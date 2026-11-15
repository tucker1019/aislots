package postgres_test

import (
	"aislots/slots_service/internal/application/bet"
	"aislots/slots_service/internal/application/betlist"
	"aislots/slots_service/internal/application/play"
	game "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/domain/identity"
	"aislots/slots_service/internal/games/ag6"
	"aislots/slots_service/internal/infrastructure/postgres"
	"aislots/slots_service/internal/transport/httpapi"
	"context"
	"encoding/json"
	"github.com/jackc/pgx/v5"
	"io"
	"log/slog"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

type ag6Games struct{ current, old game.Runtime }

func (g ag6Games) Resolve(id, version string) (bet.Spinner, error) {
	if id != "AG6" {
		return nil, bet.ErrGameUnavailable
	}
	if version == "" || version == g.current.Version() {
		return g.current, nil
	}
	if g.old != nil && version == g.old.Version() {
		return g.old, nil
	}
	return nil, bet.ErrGameUnavailable
}
func ag6Module(t *testing.T, trigger, hit bool, raw string) (*ag6.Runtime, *ag4Reader) {
	t.Helper()
	root := "../../../testdata/deployments/2026-11-15-ag6/AG6"
	c, err := ag6.LoadConfig(root)
	if err != nil {
		t.Fatal(err)
	}
	b, _, err := ag6.LoadLibrary(c, "base", filepath.Join(root, "base-library"))
	if err != nil {
		t.Fatal(err)
	}
	f, _, err := ag6.LoadLibrary(c, "free", filepath.Join(root, "free-library"))
	if err != nil {
		t.Fatal(err)
	}
	c.Parameters.Trigger = "0"
	if trigger {
		c.Parameters.Trigger = "1"
	}
	c.Parameters.BaseWin = "0"
	if hit {
		c.Parameters.BaseWin = "1"
	}
	c.Base = []ag6.WeightRow{{"5", "1"}}
	c.Free = []ag6.WeightRow{{json.Number(raw), "1"}}
	reader := &ag4Reader{source: rand.New(rand.NewSource(1019))}
	r, err := ag6.New(c, b, f, ag6.Options{Random: reader})
	if err != nil {
		t.Fatal(err)
	}
	return r, reader
}
func ag6Policies(t *testing.T) *betlist.Service {
	t.Helper()
	s, err := betlist.New([]betlist.Policy{{GameID: "AG6", Country: "ID", Currency: "IDR", Amounts: []int64{10}, Default: 10, AmountScale: 2, LineCount: 5, BetLevel: 10}})
	if err != nil {
		t.Fatal(err)
	}
	return s
}
func ag6Service(t *testing.T, store play.Store, g ag6Games) *play.Service {
	t.Helper()
	s, err := play.New(store, g, ag6Policies(t), profile())
	if err != nil {
		t.Fatal(err)
	}
	return s
}

type ag6Launch struct{}

func (ag6Launch) VerifyLaunch(_ context.Context, ticket, exchange, id string) (identity.Context, int64, string, error) {
	if id != "AG6" || ticket != strings.Repeat("a", 52) || exchange != "ag6-launch-exchange-1019" {
		return identity.Context{}, 0, "", play.ErrUnauthorized
	}
	return profile().Player(), 500000, "ag6-launch-access-token", nil
}
func (ag6Launch) Matches(p identity.Context) bool { return p == profile().Player() }

func TestAG6FinalOnlyCreditsRestartReplayAndHTTP(t *testing.T) {
	store, dsn := database(t)
	ctx := context.Background()
	old, reader := ag6Module(t, true, true, "50")
	s := ag6Service(t, store, ag6Games{current: old})
	auth, err := s.Login(ctx, play.LoginRequest{Test: true, AppName: profile().AppName, AppKey: profile().AppKey, UID: profile().UID, GameID: "AG6"})
	if err != nil {
		t.Fatal(err)
	}
	session, err := s.Authenticate(ctx, auth.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	state, err := s.Status(ctx, session, "AG6")
	if err != nil {
		t.Fatal(err)
	}
	if err = store.WithPlayer(ctx, session.Player, func(tx play.Tx) error { _, e := tx.Wallet(ctx, "ag6-drain", "debit", -499951); return e }); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Spin(ctx, session, "AG6", state.RequestID, 100); err == nil || reader.calls.Load() != 0 {
		t.Fatal("insufficient funds sampled", err)
	}
	if err = store.WithPlayer(ctx, session.Player, func(tx play.Tx) error { _, e := tx.Wallet(ctx, "ag6-restore", "credit", 499951); return e }); err != nil {
		t.Fatal(err)
	}
	first, err := s.Spin(ctx, session, "AG6", state.RequestID, 100)
	if err != nil {
		t.Fatal(err)
	}
	if first.WinAmount != 0 || first.Balance != 499900 || first.TotalWinAmount != 0 || first.NextAction != "continue" || first.Mode != "respin" || first.FreeRemaining != 0 || first.TriggeredFree {
		t.Fatal("first special board credited or claimed free session", first)
	}
	draws := reader.calls.Load()
	store.Close()
	restarted, err := postgres.Open(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer restarted.Close()
	current, newReader := ag6Module(t, false, true, "50")
	s = ag6Service(t, restarted, ag6Games{current: current, old: old})
	again, err := s.Spin(ctx, session, "AG6", state.RequestID, 100)
	if err != nil || !reflect.DeepEqual(first, again) {
		t.Fatal("retry changed", err)
	}
	recovery, err := s.Status(ctx, session, "AG6")
	if err != nil || !recovery.HasNext || recovery.LastFrame == nil || !reflect.DeepEqual(recovery.LastFrame.Board, first.Board) || !sameJSON(recovery.LastFrame.GameData, first.GameData) {
		t.Fatal("restart state", err)
	}
	partial, err := s.BetReplay(ctx, session, "AG6", first.BetID, 100, "")
	if err != nil || len(partial.Frames) != 1 {
		t.Fatal("future boards exposed", err)
	}
	if _, err = s.Spin(ctx, session, "AG6", first.NextRequestID, 200); err == nil {
		t.Fatal("stake changed mid feature")
	}
	settled := []play.Frame{first}
	last := first
	for last.NextAction != "complete" {
		id := last.NextRequestID
		last, err = s.Spin(ctx, session, "AG6", id, 100)
		if err != nil {
			t.Fatal(err)
		}
		duplicate, err := s.Spin(ctx, session, "AG6", id, 100)
		if err != nil || !reflect.DeepEqual(last, duplicate) {
			t.Fatal("frame retry changed", err)
		}
		settled = append(settled, last)
		if last.NextAction != "complete" && (last.WinAmount != 0 || last.TotalWinAmount != 0 || last.Balance != 499900) {
			t.Fatal("intermediate credit", last)
		}
	}
	if last.WinAmount != 1000 || last.TotalWinAmount != 1000 || last.Balance != 500900 || len(settled) < 3 || len(settled) > 6 || reader.calls.Load() != draws || newReader.calls.Load() != 0 {
		t.Fatal("final credit/version/redraw", last)
	}
	replay, err := s.BetReplay(ctx, session, "AG6", first.BetID, 100, "")
	if err != nil || len(replay.Frames) != len(settled) {
		t.Fatal("replay", err)
	}
	for i, f := range replay.Frames {
		if !reflect.DeepEqual(f.Board, settled[i].Board) || !sameJSON(f.GameData, settled[i].GameData) || paidSum(t, f) != f.WinAmount {
			t.Fatal("replay differs", i, f)
		}
	}
	page, err := s.BetReplay(ctx, session, "AG6", first.BetID, 2, "")
	if err != nil || len(page.Frames) != 2 || page.NextCursor == "" {
		t.Fatal("page", err)
	}
	page, err = s.BetReplay(ctx, session, "AG6", first.BetID, 2, page.NextCursor)
	if err != nil || page.Frames[0].StepIndex != 3 {
		t.Fatal("page cursor", err)
	}
	share, err := s.CreateReplayShare(ctx, session, "AG6", first.BetID)
	if err != nil {
		t.Fatal(err)
	}
	public, err := s.SharedReplay(ctx, "AG6", first.BetID, share.ShareToken, 100, "")
	if err != nil || len(public.Frames) != len(settled) {
		t.Fatal("shared", err)
	}
	for i, f := range public.Frames {
		if f.Balance != 0 || !sameJSON(f.GameData, settled[i].GameData) || paidSum(t, f) != settled[i].WinAmount {
			t.Fatal("public differs", i)
		}
	}
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(ctx)
	var debits, credits, stored int
	if err = conn.QueryRow(ctx, `SELECT count(*) FILTER(WHERE kind='debit'),count(*) FILTER(WHERE kind='credit') FROM test_wallet_ledger WHERE operation_id LIKE $1`, first.BetID+":%").Scan(&debits, &credits); err != nil || debits != 1 || credits != 1 {
		t.Fatal("ledger duplicated", debits, credits, err)
	}
	if err = conn.QueryRow(ctx, `SELECT count(*) FROM game_spins WHERE bet_id=$1`, first.BetID).Scan(&stored); err != nil || stored != 1 {
		t.Fatal("draw per board", err)
	}
	server := httptest.NewServer(httpapi.NewGameRouter(func() bool { return true }, s, nil, slog.New(slog.NewTextHandler(io.Discard, nil))))
	defer server.Close()
	req, _ := http.NewRequestWithContext(ctx, "POST", server.URL+"/api/v1/games/AG6/spin", strings.NewReader(`{"requestId":"`+last.NextRequestID+`","bet":"10","betLevel":2}`))
	req.Header.Set("Authorization", "Bearer "+auth.AccessToken)
	req.Header.Set("Content-Type", "application/json")
	response, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	var envelope struct{ Data play.Frame }
	if err = json.NewDecoder(response.Body).Decode(&envelope); err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != 200 || envelope.Data.Mode != "base" || envelope.Data.WinAmount != 100 || envelope.Data.NextAction != "complete" || newReader.calls.Load() == 0 {
		t.Fatal("HTTP next version", response.Status, envelope)
	}
}
func TestAG6AutoRoundIdempotencyAndJackpot(t *testing.T) {
	store, _ := database(t)
	ctx := context.Background()
	r, reader := ag6Module(t, true, true, "5000")
	session := play.Session{Player: profile().Player(), GameID: "AG6", ExpiresAt: time.Now().Add(time.Hour)}
	if _, err := store.CreateSession(ctx, "ag6-auto", session, 500000); err != nil {
		t.Fatal(err)
	}
	s, err := play.NewLive(store, ag6Games{current: r}, ag6Policies(t), autoLauncher{})
	if err != nil {
		t.Fatal(err)
	}
	req := play.AutoRoundRequest{RequestID: "ag6-auto-1", UID: 1, GameID: "AG6", Bet: 10, BetLevel: 1, Country: "ID", Currency: "IDR"}
	first, err := s.AutoRound(ctx, req)
	if err != nil {
		t.Fatal(err)
	}
	draws := reader.calls.Load()
	again, err := s.AutoRound(ctx, req)
	if err != nil || first != again || reader.calls.Load() != draws {
		t.Fatal("auto redrew", err)
	}
	replay, err := s.BetReplay(ctx, session, "AG6", first.BetID, 100, "")
	if err != nil || len(replay.Frames) < 6 || len(replay.Frames) > 9 {
		t.Fatal("auto sequence", err)
	}
	for i, f := range replay.Frames {
		if paidSum(t, f) != f.WinAmount {
			t.Fatal("item amounts")
		}
		if i < len(replay.Frames)-1 && f.WinAmount != 0 {
			t.Fatal("early auto credit")
		}
	}
	final := replay.Frames[len(replay.Frames)-1]
	var data ag6.FeatureData
	_ = json.Unmarshal(final.GameData, &data)
	if !data.Jackpot || len(final.Wins) != 1 || final.WinAmount != 50000 || final.TotalWinAmount != 50000 {
		t.Fatal("jackpot replacement", final, data)
	}
}
func TestAG6LaunchBetsAndOrdinaryHTTP(t *testing.T) {
	store, _ := database(t)
	ctx := context.Background()
	r, _ := ag6Module(t, false, true, "50")
	s, err := play.NewLive(store, ag6Games{current: r}, ag6Policies(t), ag6Launch{})
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(httpapi.NewGameRouter(func() bool { return true }, s, nil, slog.New(slog.NewTextHandler(io.Discard, nil))))
	defer server.Close()
	request := func(method, path, body, token string, out any) {
		t.Helper()
		req, _ := http.NewRequestWithContext(ctx, method, server.URL+path, strings.NewReader(body))
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		if body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		response, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		if response.StatusCode != 200 {
			raw, _ := io.ReadAll(response.Body)
			t.Fatal(path, response.Status, string(raw))
		}
		if err = json.NewDecoder(response.Body).Decode(out); err != nil {
			t.Fatal(err)
		}
	}
	var login struct{ Data play.LoginResponse }
	body, _ := json.Marshal(play.LoginRequest{LaunchTicket: strings.Repeat("a", 52), ExchangeID: "ag6-launch-exchange-1019", GameID: "AG6"})
	request("POST", "/api/v1/login", string(body), "", &login)
	var bets struct {
		Data struct {
			LineCount   int      `json:"lineCount"`
			AmountScale int      `json:"amountScale"`
			BetOptions  []string `json:"betOptions"`
		}
	}
	request("GET", "/api/v1/games/AG6/bets", "", login.Data.AccessToken, &bets)
	if bets.Data.LineCount != 5 || bets.Data.AmountScale != 2 || len(bets.Data.BetOptions) != 1 {
		t.Fatal(bets)
	}
	var state struct{ Data play.Status }
	request("GET", "/api/v1/games/AG6/state", "", login.Data.AccessToken, &state)
	var frame struct{ Data play.Frame }
	request("POST", "/api/v1/games/AG6/spin", `{"requestId":"`+state.Data.RequestID+`","bet":"10","betLevel":1}`, login.Data.AccessToken, &frame)
	if frame.Data.BetAmount != 50 || frame.Data.WinAmount != 50 || frame.Data.Mode != "base" || frame.Data.NextAction != "complete" {
		t.Fatal("orange payout HTTP", frame)
	}
}
