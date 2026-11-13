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
	"sync/atomic"
	"testing"
	"time"

	"aislots/slots_service/internal/application/bet"
	"aislots/slots_service/internal/application/betlist"
	"aislots/slots_service/internal/application/play"
	game "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/games/ag4"
	"aislots/slots_service/internal/infrastructure/postgres"
	"aislots/slots_service/internal/transport/httpapi"
)

type ag4Reader struct {
	calls  atomic.Int64
	source io.Reader
}

func (r *ag4Reader) Read(p []byte) (int, error) { r.calls.Add(1); return r.source.Read(p) }

type ag4Games struct{ current, old game.Runtime }

func (g ag4Games) Resolve(id, version string) (bet.Spinner, error) {
	if id != "AG4" {
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

func ag4Module(t *testing.T, respin bool) (*ag4.Runtime, *ag4Reader) {
	t.Helper()
	root := "../../../testdata/deployments/2026-11-13-ag4-modules/AG4"
	c, err := ag4.LoadConfig(root)
	if err != nil {
		t.Fatal(err)
	}
	b, _, err := ag4.LoadLibrary(c, "base", filepath.Join(root, "base-library"))
	if err != nil {
		t.Fatal(err)
	}
	f, _, err := ag4.LoadLibrary(c, "free", filepath.Join(root, "free-library"))
	if err != nil {
		t.Fatal(err)
	}
	c.Parameters.BaseWin = "1"
	c.Parameters.RespinWin = "1"
	c.Parameters.Trigger = "0"
	if respin {
		c.Parameters.Trigger = "1"
	}
	reader := &ag4Reader{source: rand.New(rand.NewSource(1017))}
	module, err := ag4.New(c, b, f, ag4.Options{Random: reader, MaxFillAttempts: 64})
	if err != nil {
		t.Fatal(err)
	}
	return module, reader
}
func ag4Policies(t *testing.T) *betlist.Service {
	t.Helper()
	s, err := betlist.New([]betlist.Policy{{GameID: "AG4", Country: "ID", Currency: "IDR", Amounts: []int64{10}, Default: 10, AmountScale: 2, LineCount: 5, BetLevel: 10}})
	if err != nil {
		t.Fatal(err)
	}
	return s
}
func ag4Service(t *testing.T, store play.Store, g ag4Games) *play.Service {
	t.Helper()
	s, err := play.New(store, g, ag4Policies(t), profile())
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestAG4ProgressiveRestartVersionPinningReplayAndHTTP(t *testing.T) {
	store, dsn := database(t)
	ctx := context.Background()
	old, oldReader := ag4Module(t, true)
	s := ag4Service(t, store, ag4Games{current: old})
	auth, err := s.Login(ctx, play.LoginRequest{Test: true, AppName: profile().AppName, AppKey: profile().AppKey, UID: profile().UID, GameID: "AG4"})
	if err != nil {
		t.Fatal(err)
	}
	session, err := s.Authenticate(ctx, auth.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	state, err := s.Status(ctx, session, "AG4")
	if err != nil {
		t.Fatal(err)
	}
	if err = store.WithPlayer(ctx, session.Player, func(tx play.Tx) error { _, e := tx.Wallet(ctx, "ag4-test-drain", "debit", -499951); return e }); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Spin(ctx, session, "AG4", state.RequestID, 50); err == nil || oldReader.calls.Load() != 0 {
		t.Fatal("insufficient funds drew an outcome", err)
	}
	if err = store.WithPlayer(ctx, session.Player, func(tx play.Tx) error { _, e := tx.Wallet(ctx, "ag4-test-restore", "credit", 499951); return e }); err != nil {
		t.Fatal(err)
	}
	first, err := s.Spin(ctx, session, "AG4", state.RequestID, 50)
	if err != nil {
		t.Fatal(err)
	}
	if first.WinAmount != 0 || first.Balance != 499950 || first.Mode != "respin" || len(first.GameData) == 0 {
		t.Fatal("wrong initial respin", first)
	}
	draws := oldReader.calls.Load()
	if draws == 0 {
		t.Fatal("did not draw")
	}
	store.Close()
	restarted, err := postgres.Open(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer restarted.Close()
	current, newReader := ag4Module(t, false)
	s = ag4Service(t, restarted, ag4Games{current: current, old: old})
	again, err := s.Spin(ctx, session, "AG4", state.RequestID, 50)
	if err != nil || !reflect.DeepEqual(first, again) {
		t.Fatal("lost first response not idempotent", err)
	}
	recovery, err := s.Status(ctx, session, "AG4")
	if err != nil || recovery.LastFrame == nil || recovery.LastFrame.BetID != first.BetID || recovery.LastFrame.Balance != 499950 {
		t.Fatal("restart state", recovery, err)
	}
	plan, err := s.AG4Presentation(ctx, session, first.BetID)
	if err != nil || len(plan) < 2 || plan[0].StepIndex != 1 || plan[len(plan)-1].NextAction != "complete" {
		t.Fatalf("saved AG4 presentation: len=%d, error=%v", len(plan), err)
	}
	unchanged, err := s.Status(ctx, session, "AG4")
	if err != nil || !reflect.DeepEqual(unchanged, recovery) || oldReader.calls.Load() != draws {
		t.Fatal("presentation advanced settlement or drew another round", err)
	}
	for _, f := range plan {
		if f.Balance != 0 || f.RequestID != "" || f.NextRequestID != "" || f.Next != nil {
			t.Fatal("presentation exposed settlement metadata", f)
		}
	}
	last := first
	frames := 1
	for last.NextAction != "complete" {
		last, err = s.Spin(ctx, session, "AG4", last.NextRequestID, 50)
		if err != nil {
			t.Fatal(err)
		}
		frames++
		if last.NextAction != "complete" && last.WinAmount != 0 {
			t.Fatal("early credit")
		}
	}
	if len(plan) != frames || !reflect.DeepEqual(plan[frames-1].Board, last.Board) || plan[frames-1].TotalWinAmount != last.TotalWinAmount {
		t.Fatal("settled result differs from saved presentation", last)
	}
	if oldReader.calls.Load() != draws || newReader.calls.Load() != 0 || last.Balance != 499950+last.TotalWinAmount || last.WinAmount != last.TotalWinAmount {
		t.Fatal("redraw, version switch or duplicate credit", last)
	}
	replay, err := s.BetReplay(ctx, session, "AG4", first.BetID, 100, "")
	if err != nil || len(replay.Frames) != frames || len(replay.StartBoard) != 0 {
		t.Fatal("replay", replay, err)
	}
	var payout int64
	for _, w := range replay.Frames[len(replay.Frames)-1].Payouts {
		n, err := strconv.ParseInt(w.Amount, 10, 64)
		if err != nil {
			t.Fatal(err)
		}
		payout += n
	}
	if payout != last.WinAmount {
		t.Fatal("replay line payouts differ", payout, last.WinAmount)
	}
	rank, err := restarted.RankReplaySession(ctx, "AG4", first.BetID, session.Player.Subject.UID)
	if err != nil || rank.Player != session.Player {
		t.Fatal("rank replay", err)
	}
	share, err := s.CreateReplayShare(ctx, session, "AG4", first.BetID)
	if err != nil {
		t.Fatal(err)
	}
	public, err := s.SharedReplay(ctx, "AG4", first.BetID, share.ShareToken, 100, "")
	if err != nil || len(public.Frames) != frames || public.Frames[0].Balance != 0 || len(public.Frames[0].GameData) == 0 {
		t.Fatal("shared replay", public, err)
	}
	// The next paid spin selects the new version and exercises the actual HTTP
	// codec, including AG4-only gameData, on the same persisted player state.
	server := httptest.NewServer(httpapi.NewGameRouter(func() bool { return true }, s, []string{"http://localhost:5180"}, slog.New(slog.NewTextHandler(io.Discard, nil))))
	defer server.Close()
	body := `{"requestId":"` + last.NextRequestID + `","bet":"10","betLevel":1}`
	request, _ := http.NewRequestWithContext(ctx, "POST", server.URL+"/api/v1/games/AG4/spin", strings.NewReader(body))
	request.Header.Set("Authorization", "Bearer "+auth.AccessToken)
	request.Header.Set("Content-Type", "application/json")
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	var envelope struct{ Data play.Frame }
	if err = json.NewDecoder(response.Body).Decode(&envelope); err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != 200 || envelope.Data.Mode != "base" || envelope.Data.NextAction != "complete" || len(envelope.Data.GameData) == 0 || newReader.calls.Load() == 0 {
		t.Fatal("AG4 HTTP/current version", response.Status, envelope)
	}
	id := envelope.Data.BetID
	nextReplay, err := s.BetReplay(ctx, session, "AG4", id, 100, "")
	if err != nil || !reflect.DeepEqual(nextReplay.StartBoard, last.Board) || len(nextReplay.Frames) != 1 {
		t.Fatal("second replay should start from the final board of the first bet", nextReplay, err)
	}
	nextShare, err := s.CreateReplayShare(ctx, session, "AG4", id)
	if err != nil {
		t.Fatal(err)
	}
	nextPublic, err := s.SharedReplay(ctx, "AG4", id, nextShare.ShareToken, 100, "")
	if err != nil || !reflect.DeepEqual(nextPublic.StartBoard, last.Board) || len(nextPublic.Frames) != 1 || nextPublic.Frames[0].Balance != 0 {
		t.Fatal("public replay should expose the preceding board only", nextPublic, err)
	}
}

func TestAG4AutoRoundIdempotency(t *testing.T) {
	store, _ := database(t)
	ctx := context.Background()
	module, reader := ag4Module(t, true)
	session := play.Session{Player: profile().Player(), GameID: "AG4", ExpiresAt: time.Now().Add(time.Hour)}
	if _, err := store.CreateSession(ctx, "ag4-auto", session, 500000); err != nil {
		t.Fatal(err)
	}
	s, err := play.NewLive(store, ag4Games{current: module}, ag4Policies(t), autoLauncher{})
	if err != nil {
		t.Fatal(err)
	}
	req := play.AutoRoundRequest{RequestID: "ag4-auto-1", UID: 1, GameID: "AG4", Bet: 10, BetLevel: 1, Country: "ID", Currency: "IDR"}
	first, err := s.AutoRound(ctx, req)
	if err != nil {
		t.Fatal(err)
	}
	draws := reader.calls.Load()
	again, err := s.AutoRound(ctx, req)
	if err != nil || first != again || reader.calls.Load() != draws {
		t.Fatal("auto duplicate", again, err)
	}
	replay, err := s.BetReplay(ctx, session, "AG4", first.BetID, 100, "")
	if err != nil || len(replay.Frames) < 2 {
		t.Fatal("auto replay", replay, err)
	}
	for i, f := range replay.Frames {
		if i < len(replay.Frames)-1 && f.WinAmount != 0 {
			t.Fatal("auto early credit")
		}
	}
}
