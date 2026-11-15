package postgres_test

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"math/rand"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"testing"
	"time"

	"aislots/slots_service/internal/application/bet"
	"aislots/slots_service/internal/application/betlist"
	"aislots/slots_service/internal/application/play"
	game "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/domain/identity"
	"aislots/slots_service/internal/games/ag5"
	"aislots/slots_service/internal/infrastructure/postgres"
	"aislots/slots_service/internal/transport/httpapi"
	"github.com/jackc/pgx/v5"
)

type ag5Games struct{ current, old game.Runtime }

type ag5Launch struct{}

func (ag5Launch) VerifyLaunch(_ context.Context, ticket, exchange, gameID string) (identity.Context, int64, string, error) {
	if gameID != "AG5" || ticket != strings.Repeat("a", 52) || exchange != "ag5-launch-exchange-1018" {
		return identity.Context{}, 0, "", play.ErrUnauthorized
	}
	return profile().Player(), 500000, "ag5-launch-access-token", nil
}
func (ag5Launch) Matches(p identity.Context) bool { return p == profile().Player() }

func (g ag5Games) Resolve(id, version string) (bet.Spinner, error) {
	if id != "AG5" {
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
func ag5Module(t *testing.T, trigger, hit, cap bool) (*ag5.Runtime, *ag4Reader) {
	t.Helper()
	root := "../../../testdata/deployments/2026-11-15-ag5/AG5"
	c, err := ag5.LoadConfig(root)
	if err != nil {
		t.Fatal(err)
	}
	b, _, err := ag5.LoadLibrary(c, "base", filepath.Join(root, "base-library"))
	if err != nil {
		t.Fatal(err)
	}
	f, _, err := ag5.LoadLibrary(c, "free", filepath.Join(root, "free-library"))
	if err != nil {
		t.Fatal(err)
	}
	c.Parameters.Trigger = "0"
	if trigger {
		c.Parameters.Trigger = "1"
	}
	c.Parameters.BaseWin = "0"
	c.Parameters.FreeWin = "0"
	if hit {
		c.Parameters.BaseWin = "1"
		c.Parameters.FreeWin = "1"
	}
	c.Base = []ag5.WeightRow{{"100", "1"}}
	c.Free = []ag5.WeightRow{{"25", "1"}}
	if cap {
		c.Free = []ag5.WeightRow{{"20000", "1"}}
	}
	reader := &ag4Reader{source: rand.New(rand.NewSource(1018))}
	r, err := ag5.New(c, b, f, ag5.Options{Random: reader})
	if err != nil {
		t.Fatal(err)
	}
	return r, reader
}
func ag5Policies(t *testing.T) *betlist.Service {
	t.Helper()
	s, err := betlist.New([]betlist.Policy{{GameID: "AG5", Country: "ID", Currency: "IDR", Amounts: []int64{10}, Default: 10, AmountScale: 2, LineCount: 10, BetLevel: 10}})
	if err != nil {
		t.Fatal(err)
	}
	return s
}
func ag5Service(t *testing.T, store play.Store, g ag5Games) *play.Service {
	t.Helper()
	s, err := play.New(store, g, ag5Policies(t), profile())
	if err != nil {
		t.Fatal(err)
	}
	return s
}
func sameJSON(a, b json.RawMessage) bool {
	var x, y any
	return json.Unmarshal(a, &x) == nil && json.Unmarshal(b, &y) == nil && reflect.DeepEqual(x, y)
}
func paidSum(t *testing.T, frame play.ReplayFrame) int64 {
	t.Helper()
	var sum int64
	for _, w := range frame.Payouts {
		n, err := strconv.ParseInt(w.Amount, 10, 64)
		if err != nil {
			t.Fatal(err)
		}
		sum += n
	}
	return sum
}

func TestAG5ImmediateCreditsRestartPinningReplayAndHTTP(t *testing.T) {
	store, dsn := database(t)
	ctx := context.Background()
	old, reader := ag5Module(t, true, true, false)
	s := ag5Service(t, store, ag5Games{current: old})
	auth, err := s.Login(ctx, play.LoginRequest{Test: true, AppName: profile().AppName, AppKey: profile().AppKey, UID: profile().UID, GameID: "AG5"})
	if err != nil {
		t.Fatal(err)
	}
	session, err := s.Authenticate(ctx, auth.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	state, err := s.Status(ctx, session, "AG5")
	if err != nil {
		t.Fatal(err)
	}
	if err = store.WithPlayer(ctx, session.Player, func(tx play.Tx) error { _, e := tx.Wallet(ctx, "ag5-drain", "debit", -499951); return e }); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Spin(ctx, session, "AG5", state.RequestID, 100); err == nil || reader.calls.Load() != 0 {
		t.Fatal("insufficient funds drew", err)
	}
	if err = store.WithPlayer(ctx, session.Player, func(tx play.Tx) error { _, e := tx.Wallet(ctx, "ag5-restore", "credit", 499951); return e }); err != nil {
		t.Fatal(err)
	}
	first, err := s.Spin(ctx, session, "AG5", state.RequestID, 100)
	if err != nil {
		t.Fatal(err)
	}
	if first.WinAmount != 1000 || first.Balance != 500900 || first.TotalWinAmount != 1000 || first.FreeRemaining != 8 || !first.TriggeredFree || first.Mode != "base" || first.NextAction != "continue" || len(first.Board) != 3 {
		t.Fatal("ordinary not settled before feature", first)
	}
	draws := reader.calls.Load()
	store.Close()
	restarted, err := postgres.Open(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer restarted.Close()
	current, newReader := ag5Module(t, false, true, false)
	s = ag5Service(t, restarted, ag5Games{current: current, old: old})
	again, err := s.Spin(ctx, session, "AG5", state.RequestID, 100)
	if err != nil || !reflect.DeepEqual(first, again) {
		t.Fatal("first retry changed", err)
	}
	recovery, err := s.Status(ctx, session, "AG5")
	if err != nil || !recovery.HasNext || recovery.LastFrame == nil || !reflect.DeepEqual(first.Board, recovery.LastFrame.Board) || !sameJSON(first.GameData, recovery.LastFrame.GameData) {
		t.Fatal("restart recovery", recovery, err)
	}
	partial, err := s.BetReplay(ctx, session, "AG5", first.BetID, 100, "")
	if err != nil || len(partial.Frames) != 1 {
		t.Fatal("future frames leaked", partial, err)
	}
	if _, err = s.Spin(ctx, session, "AG5", first.NextRequestID, 200); err == nil {
		t.Fatal("changed stake accepted")
	}
	settled := []play.Frame{first}
	last := first
	for last.NextAction != "complete" {
		requestID := last.NextRequestID
		last, err = s.Spin(ctx, session, "AG5", requestID, 100)
		if err != nil {
			t.Fatal(err)
		}
		duplicate, err := s.Spin(ctx, session, "AG5", requestID, 100)
		if err != nil || !reflect.DeepEqual(last, duplicate) {
			t.Fatal("special retry changed", err)
		}
		settled = append(settled, last)
		index := len(settled) - 1
		if last.WinAmount != 250 || last.TotalWinAmount != 1000+int64(index)*250 || last.Balance != 500900+int64(index)*250 || last.FreeRemaining != 8-index || last.SpinIndex != 0 || last.StepIndex != index+1 {
			t.Fatal("special credit/progress", last)
		}
	}
	if len(settled) != 9 || reader.calls.Load() != draws || newReader.calls.Load() != 0 || last.TotalWinAmount != 3000 {
		t.Fatal("redraw, early finish or version switch", last)
	}
	replay, err := s.BetReplay(ctx, session, "AG5", first.BetID, 100, "")
	if err != nil || len(replay.Frames) != 9 {
		t.Fatal("replay", err)
	}
	for i, f := range replay.Frames {
		if !reflect.DeepEqual(f.Board, settled[i].Board) || !sameJSON(f.GameData, settled[i].GameData) || paidSum(t, f) != f.WinAmount || f.TotalWinAmount != settled[i].TotalWinAmount {
			t.Fatal("replay differs", i, f)
		}
	}
	share, err := s.CreateReplayShare(ctx, session, "AG5", first.BetID)
	if err != nil {
		t.Fatal(err)
	}
	public, err := s.SharedReplay(ctx, "AG5", first.BetID, share.ShareToken, 100, "")
	if err != nil || len(public.Frames) != 9 {
		t.Fatal("public replay", err)
	}
	for i, f := range public.Frames {
		if f.Balance != 0 || !sameJSON(f.GameData, settled[i].GameData) || paidSum(t, f) != settled[i].WinAmount {
			t.Fatal("public lost paid data", i)
		}
	}
	page, err := s.BetReplay(ctx, session, "AG5", first.BetID, 2, "")
	if err != nil || len(page.Frames) != 2 || page.NextCursor == "" {
		t.Fatal("page", err)
	}
	page, err = s.BetReplay(ctx, session, "AG5", first.BetID, 2, page.NextCursor)
	if err != nil || page.Frames[0].StepIndex != 3 || paidSum(t, page.Frames[0]) != 250 {
		t.Fatal("page paid details", err)
	}
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(ctx)
	var debits, credits, stored int
	if err = conn.QueryRow(ctx, `SELECT count(*) FILTER(WHERE kind='debit'),count(*) FILTER(WHERE kind='credit') FROM test_wallet_ledger WHERE operation_id LIKE $1`, first.BetID+":%").Scan(&debits, &credits); err != nil || debits != 1 || credits != 9 {
		t.Fatal("ledger duplicate", debits, credits, err)
	}
	if err = conn.QueryRow(ctx, `SELECT count(*) FROM game_spins WHERE bet_id=$1`, first.BetID).Scan(&stored); err != nil || stored != 1 {
		t.Fatal("redrew per frame", stored, err)
	}
	server := httptest.NewServer(httpapi.NewGameRouter(func() bool { return true }, s, []string{"http://localhost:5180"}, slog.New(slog.NewTextHandler(io.Discard, nil))))
	defer server.Close()
	body := `{"requestId":"` + last.NextRequestID + `","bet":"10","betLevel":1}`
	req, _ := http.NewRequestWithContext(ctx, "POST", server.URL+"/api/v1/games/AG5/spin", strings.NewReader(body))
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
	if response.StatusCode != 200 || envelope.Data.NextAction != "complete" || envelope.Data.Mode != "base" || newReader.calls.Load() == 0 || envelope.Data.WinAmount != 1000 {
		t.Fatal("HTTP/new version", response.Status, envelope)
	}
}

func TestAG5CapAndAllLossSpecials(t *testing.T) {
	for _, hit := range []bool{true, false} {
		t.Run(strconv.FormatBool(hit), func(t *testing.T) {
			store, _ := database(t)
			ctx := context.Background()
			r, _ := ag5Module(t, true, hit, true)
			s := ag5Service(t, store, ag5Games{current: r})
			session := play.Session{Player: profile().Player(), GameID: "AG5", ExpiresAt: time.Now().Add(time.Hour)}
			if _, err := store.CreateSession(ctx, "ag5-cap", session, 500000); err != nil {
				t.Fatal(err)
			}
			state, err := s.Status(ctx, session, "AG5")
			if err != nil {
				t.Fatal(err)
			}
			last, err := s.Spin(ctx, session, "AG5", state.RequestID, 100)
			if err != nil {
				t.Fatal(err)
			}
			first := last
			count := 1
			for last.NextAction != "complete" {
				last, err = s.Spin(ctx, session, "AG5", last.NextRequestID, 100)
				if err != nil {
					t.Fatal(err)
				}
				count++
			}
			want := int64(0)
			frames := 9
			if hit {
				want = 500000
				frames = 4
			}
			if last.TotalWinAmount != want || count != frames || last.FreeRemaining != 0 || last.Balance != 500000-100+want {
				t.Fatal("cap/loss flow", last, count)
			}
			replay, err := s.BetReplay(ctx, session, "AG5", first.BetID, 100, "")
			if err != nil || len(replay.Frames) != frames {
				t.Fatal(err)
			}
			for _, f := range replay.Frames {
				if paidSum(t, f) != f.WinAmount {
					t.Fatal("cap payout sum", f)
				}
			}
			if hit {
				f := replay.Frames[len(replay.Frames)-1]
				var data ag5.FeatureData
				if err = json.Unmarshal(f.GameData, &data); err != nil {
					t.Fatal(err)
				}
				if !data.Capped || data.TruncatedAmount != 101000 || f.WinAmount != 99000 {
					t.Fatal("wrong final headroom", f, data)
				}
			}
		})
	}
}

func TestAG5AutoRoundIdempotency(t *testing.T) {
	store, _ := database(t)
	ctx := context.Background()
	r, reader := ag5Module(t, true, true, false)
	session := play.Session{Player: profile().Player(), GameID: "AG5", ExpiresAt: time.Now().Add(time.Hour)}
	if _, err := store.CreateSession(ctx, "ag5-auto", session, 500000); err != nil {
		t.Fatal(err)
	}
	s, err := play.NewLive(store, ag5Games{current: r}, ag5Policies(t), autoLauncher{})
	if err != nil {
		t.Fatal(err)
	}
	req := play.AutoRoundRequest{RequestID: "ag5-auto-1", UID: 1, GameID: "AG5", Bet: 10, BetLevel: 1, Country: "ID", Currency: "IDR"}
	first, err := s.AutoRound(ctx, req)
	if err != nil {
		t.Fatal(err)
	}
	draws := reader.calls.Load()
	again, err := s.AutoRound(ctx, req)
	if err != nil || first != again || reader.calls.Load() != draws {
		t.Fatal("auto repeated", again, err)
	}
	replay, err := s.BetReplay(ctx, session, "AG5", first.BetID, 100, "")
	if err != nil || len(replay.Frames) != 9 {
		t.Fatal(err)
	}
	for _, f := range replay.Frames {
		if f.WinAmount <= 0 || paidSum(t, f) != f.WinAmount {
			t.Fatal("auto deferred credit", f)
		}
	}
}

func TestAG5PublicLaunchBetsStateSpinContract(t *testing.T) {
	store, _ := database(t)
	ctx := context.Background()
	r, _ := ag5Module(t, false, true, false)
	s, err := play.NewLive(store, ag5Games{current: r}, ag5Policies(t), ag5Launch{})
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
			data, _ := io.ReadAll(response.Body)
			t.Fatal(path, response.Status, string(data))
		}
		if err = json.NewDecoder(response.Body).Decode(out); err != nil {
			t.Fatal(err)
		}
	}
	var login struct{ Data play.LoginResponse }
	body, _ := json.Marshal(play.LoginRequest{LaunchTicket: strings.Repeat("a", 52), ExchangeID: "ag5-launch-exchange-1018", GameID: "AG5"})
	request("POST", "/api/v1/login", string(body), "", &login)
	if login.Data.AccessToken != "ag5-launch-access-token" || login.Data.Balance != 500000 {
		t.Fatal("launch contract", login)
	}
	var bets struct {
		Data struct {
			LineCount   int      `json:"lineCount"`
			AmountScale int      `json:"amountScale"`
			BetOptions  []string `json:"betOptions"`
		}
	}
	request("GET", "/api/v1/games/AG5/bets", "", login.Data.AccessToken, &bets)
	if bets.Data.LineCount != 10 || bets.Data.AmountScale != 2 || len(bets.Data.BetOptions) != 1 || bets.Data.BetOptions[0] != "10" {
		t.Fatal("bets contract", bets)
	}
	var state struct{ Data play.Status }
	request("GET", "/api/v1/games/AG5/state", "", login.Data.AccessToken, &state)
	var frame struct{ Data play.Frame }
	request("POST", "/api/v1/games/AG5/spin", `{"requestId":"`+state.Data.RequestID+`","bet":"10","betLevel":1}`, login.Data.AccessToken, &frame)
	if frame.Data.BetAmount != 100 || frame.Data.WinAmount != 1000 || frame.Data.NextAction != "complete" || frame.Data.NextRequestID == "" {
		t.Fatal("spin contract", frame)
	}
}
