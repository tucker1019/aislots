package postgres_test

import (
	"aislots/slots_service/internal/application/bet"
	"aislots/slots_service/internal/application/betlist"
	"aislots/slots_service/internal/application/play"
	game "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/games/ag8"
	"aislots/slots_service/internal/infrastructure/postgres"
	"aislots/slots_service/internal/transport/httpapi"
	"context"
	"encoding/json"
	"errors"
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

	"github.com/jackc/pgx/v5"
)

type ag8Games struct{ current, old game.Runtime }

func (g ag8Games) Resolve(id, version string) (bet.Spinner, error) {
	if id == "AG8" {
		if version == "" || version == g.current.Version() {
			return g.current, nil
		}
		if g.old != nil && version == g.old.Version() {
			return g.old, nil
		}
	}
	return nil, bet.ErrGameUnavailable
}

func ag8Module(t *testing.T, feature, hit bool, raw string) (*ag8.Runtime, *ag4Reader) {
	t.Helper()
	root := "../../../testdata/deployments/2026-11-15-ag8/AG8"
	c, err := ag8.LoadConfig(root)
	if err != nil {
		t.Fatal(err)
	}
	b, _, err := ag8.LoadLibrary(c, "base", filepath.Join(root, "base-library"))
	if err != nil {
		t.Fatal(err)
	}
	f, _, err := ag8.LoadLibrary(c, "free", filepath.Join(root, "free-library"))
	if err != nil {
		t.Fatal(err)
	}
	c.Parameters.Trigger = "0"
	if feature {
		c.Parameters.Trigger = "1"
	}
	p := json.Number("0")
	if hit {
		p = "1"
	}
	c.Parameters.BaseWin, c.Parameters.FreeWin = p, p
	c.Dragon.Boost.BaseWin, c.Dragon.Boost.FreeWin = p, p
	c.Base = []ag8.WeightRow{{json.Number(raw), "1"}}
	c.Free, c.Dragon.Boost.Base, c.Dragon.Boost.Free = c.Base, c.Base, c.Base
	c.Dragon.NormalMultipliers = []ag8.WeightRow{{"5", "1"}}
	c.Dragon.FreeMultiplierCounts = []ag8.WeightRow{{"3", "1"}}
	c.Dragon.FreeMultipliers = []ag8.WeightRow{{"10", "1"}}
	reader := &ag4Reader{source: rand.New(rand.NewSource(1048))}
	r, err := ag8.New(c, b, f, ag8.Options{Random: reader})
	if err != nil {
		t.Fatal(err)
	}
	return r, reader
}

func ag8Policies(t *testing.T) *betlist.Service {
	t.Helper()
	policies, err := betlist.New([]betlist.Policy{{GameID: "AG8", Country: "ID", Currency: "IDR", Amounts: []int64{10}, Default: 10, AmountScale: 2, LineCount: 5, BetLevel: 10}})
	if err != nil {
		t.Fatal(err)
	}
	return policies
}
func ag8Service(t *testing.T, store play.Store, g ag8Games) *play.Service {
	t.Helper()
	s, err := play.New(store, g, ag8Policies(t), profile())
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func ag8Login(t *testing.T, s *play.Service) (play.Session, string, play.Status) {
	t.Helper()
	ctx := context.Background()
	auth, err := s.Login(ctx, play.LoginRequest{Test: true, AppName: profile().AppName, AppKey: profile().AppKey, UID: profile().UID, GameID: "AG8"})
	if err != nil {
		t.Fatal(err)
	}
	session, err := s.Authenticate(ctx, auth.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	state, err := s.Status(ctx, session, "AG8")
	if err != nil {
		t.Fatal(err)
	}
	return session, auth.AccessToken, state
}

func TestAG8PerFrameCreditsRestartReplayAndLockedMode(t *testing.T) {
	store, dsn := database(t)
	ctx := context.Background()
	old, reader := ag8Module(t, true, true, "2")
	s := ag8Service(t, store, ag8Games{current: old})
	session, _, state := ag8Login(t, s)
	first, err := s.Spin(ctx, session, "AG8", state.RequestID, 250, 2)
	if err != nil {
		t.Fatal(err)
	}
	if first.BuyMode != 2 || first.BetAmount != 250 || first.WinAmount != 600 || first.Balance != 500350 || first.TotalWinAmount != 600 || first.Mode != "free" || first.FreeRemaining != 7 || !first.TriggeredFree || first.AwardedFreeSpins != 8 {
		t.Fatal("first free frame", first)
	}
	draws := reader.calls.Load()
	store.Close()
	restarted, err := postgres.Open(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer restarted.Close()
	current, nextReader := ag8Module(t, false, true, "3")
	s = ag8Service(t, restarted, ag8Games{current: current, old: old})
	duplicate, err := s.Spin(ctx, session, "AG8", state.RequestID, 250, 2)
	if err != nil || !reflect.DeepEqual(duplicate, first) {
		t.Fatal("restart retry", err)
	}
	if _, err = s.Spin(ctx, session, "AG8", state.RequestID, 250, 1); !errors.Is(err, play.ErrConflict) {
		t.Fatal("receipt mode mutable", err)
	}
	if _, err = s.Spin(ctx, session, "AG8", first.NextRequestID, 250, 1); !errors.Is(err, play.ErrConflict) {
		t.Fatal("pending mode mutable", err)
	}
	if _, err = s.Spin(ctx, session, "AG8", first.NextRequestID, 500, 2); !errors.Is(err, play.ErrConflict) {
		t.Fatal("pending amount mutable", err)
	}
	recovery, err := s.Status(ctx, session, "AG8")
	if err != nil || !recovery.HasNext || recovery.LastFrame == nil || !sameJSON(recovery.LastFrame.GameData, first.GameData) || recovery.LastFrame.BuyMode != 2 {
		t.Fatal("state mismatch", err)
	}
	partial, err := s.BetReplay(ctx, session, "AG8", first.BetID, 100, "")
	if err != nil || len(partial.Frames) != 1 {
		t.Fatal("future free frames exposed", err)
	}
	frames := []play.Frame{first}
	last := first
	for last.NextAction != "complete" {
		id := last.NextRequestID
		last, err = s.Spin(ctx, session, "AG8", id, 250, 2)
		if err != nil {
			t.Fatal(err)
		}
		duplicate, err = s.Spin(ctx, session, "AG8", id, 250, 2)
		if err != nil || !reflect.DeepEqual(duplicate, last) {
			t.Fatal("free frame retry", err)
		}
		frames = append(frames, last)
		if last.WinAmount != 600 || last.TotalWinAmount != int64(len(frames)*600) || last.Balance != int64(499750+len(frames)*600) || last.FreeRemaining != 8-len(frames) {
			t.Fatal("free frame credit", last)
		}
	}
	if len(frames) != 8 || reader.calls.Load() != draws || nextReader.calls.Load() != 0 {
		t.Fatal("feature redrew or changed version")
	}
	ag8CheckReplay(t, s, session, frames)
	ag8CheckLedger(t, dsn, first.BetID, 8)
	state, err = s.Status(ctx, session, "AG8")
	if err != nil || state.HasNext {
		t.Fatal("feature still pending", err)
	}
	next, err := s.Spin(ctx, session, "AG8", state.RequestID, 50, 1)
	if err != nil || next.WinAmount != 150 || next.Mode != "base" || nextReader.calls.Load() == 0 {
		t.Fatal("new release not used", next, err)
	}
}

func ag8CheckReplay(t *testing.T, s *play.Service, session play.Session, frames []play.Frame) {
	t.Helper()
	ctx := context.Background()
	replay, err := s.BetReplay(ctx, session, "AG8", frames[0].BetID, 100, "")
	if err != nil || len(replay.Frames) != len(frames) {
		t.Fatal("private replay", err)
	}
	share, err := s.CreateReplayShare(ctx, session, "AG8", frames[0].BetID)
	if err != nil {
		t.Fatal(err)
	}
	public, err := s.SharedReplay(ctx, "AG8", frames[0].BetID, share.ShareToken, 100, "")
	if err != nil || len(public.Frames) != len(frames) {
		t.Fatal("public replay", err)
	}
	for i, f := range frames {
		for _, saved := range []play.ReplayFrame{replay.Frames[i], public.Frames[i]} {
			if !reflect.DeepEqual(saved.Board, f.Board) || !sameJSON(saved.GameData, f.GameData) || saved.WinAmount != f.WinAmount || paidSum(t, saved) != f.WinAmount {
				t.Fatal("replay changed", i)
			}
		}
		if public.Frames[i].Balance != 0 {
			t.Fatal("public balance exposed")
		}
	}
}

func ag8CheckLedger(t *testing.T, dsn, betID string, wantCredits int) {
	t.Helper()
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = conn.Close(ctx) }()
	var debits, credits, draws int
	if err = conn.QueryRow(ctx, `SELECT count(*) FILTER(WHERE kind='debit'),count(*) FILTER(WHERE kind='credit') FROM test_wallet_ledger WHERE operation_id LIKE $1`, betID+":%").Scan(&debits, &credits); err != nil || debits != 1 || credits != wantCredits {
		t.Fatal("ledger", debits, credits, err)
	}
	if err = conn.QueryRow(ctx, `SELECT count(*) FROM game_spins WHERE bet_id=$1`, betID).Scan(&draws); err != nil || draws != 1 {
		t.Fatal("draw count", draws, err)
	}
}

func TestAG8EightEmptyFreeFramesAndCapSettlement(t *testing.T) {
	for _, tc := range []struct {
		name, raw    string
		hit          bool
		mode, count  int
		stake, total int64
	}{
		{"eight_empty", "2", false, 1, 8, 50, 0},
		{"normal_cap", "500", true, 1, 1, 50, 125000},
		{"boost_cap", "500", true, 2, 5, 250, 625000},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store, dsn := database(t)
			r, reader := ag8Module(t, true, tc.hit, tc.raw)
			s := ag8Service(t, store, ag8Games{current: r})
			session, _, state := ag8Login(t, s)
			ctx := context.Background()
			var frames []play.Frame
			for i := 0; i < 8; i++ {
				f, err := s.Spin(ctx, session, "AG8", state.RequestID, tc.stake, tc.mode)
				if err != nil {
					t.Fatal(err)
				}
				frames = append(frames, f)
				if f.Mode != "free" || (i == 0) != f.TriggeredFree {
					t.Fatal("lost free identity")
				}
				if f.NextAction == "complete" {
					break
				}
				state.RequestID = f.NextRequestID
			}
			last := frames[len(frames)-1]
			if len(frames) != tc.count || last.TotalWinAmount != int64(tc.total) || last.Balance != int64(500000-tc.stake+tc.total) || last.FreeRemaining != 0 {
				t.Fatal(last)
			}
			var data ag8.FeatureData
			if err := json.Unmarshal(last.GameData, &data); err != nil {
				t.Fatal(err)
			}
			if data.CapReached != tc.hit || (tc.mode == 2 && data.PaidRawWin != 2500) {
				t.Fatal("cap mismatch", data)
			}
			draws := reader.calls.Load()
			ag8CheckReplay(t, s, session, frames)
			credits := tc.count
			if !tc.hit {
				credits = 0
			}
			ag8CheckLedger(t, dsn, last.BetID, credits)
			if reader.calls.Load() != draws {
				t.Fatal("replay sampled")
			}
		})
	}
}

func TestAG8HTTPFivefoldDeductionKeepsOriginalLineStake(t *testing.T) {
	store, _ := database(t)
	r, reader := ag8Module(t, false, true, "2")
	s := ag8Service(t, store, ag8Games{current: r})
	_, token, state := ag8Login(t, s)
	server := httptest.NewServer(httpapi.NewGameRouter(func() bool { return true }, s, nil, slog.New(slog.NewTextHandler(io.Discard, nil))))
	defer server.Close()
	req, _ := http.NewRequest("GET", server.URL+"/api/v1/games/AG8/bets", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	response, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	var modes struct {
		Data struct {
			BuyModes []struct {
				BuyMode       int
				BetMultiplier int64
			}
		}
	}
	if err = json.NewDecoder(response.Body).Decode(&modes); err != nil {
		t.Fatal(err)
	}
	_ = response.Body.Close()
	if response.StatusCode != 200 || len(modes.Data.BuyModes) != 2 || modes.Data.BuyModes[1].BuyMode != 2 || modes.Data.BuyModes[1].BetMultiplier != 5 {
		t.Fatal("mode discovery", modes)
	}
	request := func(body string) (int, play.Frame) {
		t.Helper()
		req, _ := http.NewRequest("POST", server.URL+"/api/v1/games/AG8/spin", strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")
		response, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer func() { _ = response.Body.Close() }()
		var out struct{ Data play.Frame }
		if err = json.NewDecoder(response.Body).Decode(&out); err != nil {
			t.Fatal(err)
		}
		return response.StatusCode, out.Data
	}
	for _, body := range []string{`{"requestId":"` + state.RequestID + `","bet":"10","betLevel":1,"buyMode":3}`, `{"requestId":"` + state.RequestID + `","bet":"11","betLevel":1,"buyMode":2}`} {
		status, _ := request(body)
		if status != 400 || reader.calls.Load() != 0 {
			t.Fatal("invalid bet sampled", status)
		}
	}
	status, boost := request(`{"requestId":"` + state.RequestID + `","bet":"10","betLevel":1,"buyMode":2}`)
	if status != 200 || boost.BuyMode != 2 || boost.BetAmount != 250 || boost.WinAmount != 100 {
		t.Fatal(status, boost)
	}
	status, normal := request(`{"requestId":"` + boost.NextRequestID + `","bet":"10","betLevel":1}`)
	if status != 200 || normal.BuyMode != 1 || normal.BetAmount != 50 || normal.WinAmount != 100 {
		t.Fatal(status, normal)
	}
}

func TestAG8AutomaticRoundPreservesEightEmptyFrames(t *testing.T) {
	store, dsn := database(t)
	ctx := context.Background()
	r, reader := ag8Module(t, true, false, "2")
	session := play.Session{Player: profile().Player(), GameID: "AG8", ExpiresAt: time.Now().Add(time.Hour)}
	if _, err := store.CreateSession(ctx, "ag8-auto", session, 500000); err != nil {
		t.Fatal(err)
	}
	s, err := play.NewLive(store, ag8Games{current: r}, ag8Policies(t), autoLauncher{})
	if err != nil {
		t.Fatal(err)
	}
	req := play.AutoRoundRequest{RequestID: "ag8-auto-1", UID: 1, GameID: "AG8", Bet: 10, BetLevel: 1, Country: "ID", Currency: "IDR"}
	first, err := s.AutoRound(ctx, req)
	if err != nil {
		t.Fatal(err)
	}
	draws := reader.calls.Load()
	again, err := s.AutoRound(ctx, req)
	if err != nil || again != first || reader.calls.Load() != draws {
		t.Fatal("auto round redrew", err)
	}
	replay, err := s.BetReplay(ctx, session, "AG8", first.BetID, 100, "")
	if err != nil || len(replay.Frames) != 8 {
		t.Fatal("auto losses collapsed", err)
	}
	for _, f := range replay.Frames {
		if f.Mode != "free" || f.WinAmount != 0 || paidSum(t, f) != 0 {
			t.Fatal(f)
		}
	}
	ag8CheckLedger(t, dsn, first.BetID, 0)
}

func TestAG8ModeExtensionKeepsLegacyGamesOnOrdinaryStakes(t *testing.T) {
	store, _ := database(t)
	ctx := context.Background()
	r, reader := ag7Module(t, false, true, "50")
	s := ag7Service(t, store, ag7Games{current: r})
	auth, err := s.Login(ctx, play.LoginRequest{Test: true, AppName: profile().AppName, AppKey: profile().AppKey, UID: profile().UID, GameID: "AG7"})
	if err != nil {
		t.Fatal(err)
	}
	session, err := s.Authenticate(ctx, auth.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	state, err := s.Status(ctx, session, "AG7")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.Spin(ctx, session, "AG7", state.RequestID, 100, 2); !errors.Is(err, play.ErrInvalid) || reader.calls.Load() != 0 {
		t.Fatal("legacy boost allowed or sampled", err)
	}
	frame, err := s.Spin(ctx, session, "AG7", state.RequestID, 100)
	if err != nil || frame.BetAmount != 100 || frame.WinAmount != 50 || frame.BuyMode != 0 {
		t.Fatal("legacy ordinary changed", frame, err)
	}
}
