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
	"aislots/slots_service/internal/games/ag9"
	"aislots/slots_service/internal/infrastructure/postgres"
	"aislots/slots_service/internal/transport/httpapi"
)

type ag9Reader struct {
	calls  atomic.Int64
	source io.Reader
}

func (r *ag9Reader) Read(p []byte) (int, error) { r.calls.Add(1); return r.source.Read(p) }

type ag9Games struct{ current, old game.Runtime }

func (g ag9Games) Resolve(id, version string) (bet.Spinner, error) {
	if id != "AG9" {
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

func ag9Module(t *testing.T, respin bool) (*ag9.Runtime, *ag9Reader) {
	t.Helper()
	root := "../../../testdata/deployments/2026-11-15-ag9/AG9"
	c, err := ag9.LoadConfig(root)
	if err != nil {
		t.Fatal(err)
	}
	b, _, err := ag9.LoadLibrary(c, "base", filepath.Join(root, "base-library"))
	if err != nil {
		t.Fatal(err)
	}
	f, _, err := ag9.LoadLibrary(c, "free", filepath.Join(root, "free-library"))
	if err != nil {
		t.Fatal(err)
	}
	c.Parameters.BaseWin = "1"
	c.Parameters.RespinWin = "1"
	c.Parameters.Trigger = "0"
	if respin {
		c.Parameters.Trigger = "1"
	}
	reader := &ag9Reader{source: rand.New(rand.NewSource(1021))}
	module, err := ag9.New(c, b, f, ag9.Options{Random: reader, MaxFillAttempts: 64})
	if err != nil {
		t.Fatal(err)
	}
	return module, reader
}
func ag9Policies(t *testing.T) *betlist.Service {
	t.Helper()
	s, err := betlist.New([]betlist.Policy{{GameID: "AG9", Country: "ID", Currency: "IDR", Amounts: []int64{10}, Default: 10, AmountScale: 2, LineCount: 5, BetLevel: 10}})
	if err != nil {
		t.Fatal(err)
	}
	return s
}
func ag9Service(t *testing.T, store play.Store, g ag9Games) *play.Service {
	t.Helper()
	s, err := play.New(store, g, ag9Policies(t), profile())
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestAG9ProgressiveRestartVersionPinningReplayAndHTTP(t *testing.T) {
	store, dsn := database(t)
	ctx := context.Background()
	old, oldReader := ag9Module(t, true)
	s := ag9Service(t, store, ag9Games{current: old})
	auth, err := s.Login(ctx, play.LoginRequest{Test: true, AppName: profile().AppName, AppKey: profile().AppKey, UID: profile().UID, GameID: "AG9"})
	if err != nil {
		t.Fatal(err)
	}
	session, err := s.Authenticate(ctx, auth.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	state, err := s.Status(ctx, session, "AG9")
	if err != nil {
		t.Fatal(err)
	}
	if err = store.WithPlayer(ctx, session.Player, func(tx play.Tx) error { _, e := tx.Wallet(ctx, "ag9-test-drain", "debit", -499951); return e }); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Spin(ctx, session, "AG9", state.RequestID, 50); err == nil || oldReader.calls.Load() != 0 {
		t.Fatal("insufficient funds drew an outcome", err)
	}
	if err = store.WithPlayer(ctx, session.Player, func(tx play.Tx) error { _, e := tx.Wallet(ctx, "ag9-test-restore", "credit", 499951); return e }); err != nil {
		t.Fatal(err)
	}
	first, err := s.Spin(ctx, session, "AG9", state.RequestID, 50)
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
	current, newReader := ag9Module(t, false)
	s = ag9Service(t, restarted, ag9Games{current: current, old: old})
	again, err := s.Spin(ctx, session, "AG9", state.RequestID, 50)
	if err != nil || !reflect.DeepEqual(first, again) {
		t.Fatal("lost first response not idempotent", err)
	}
	recovery, err := s.Status(ctx, session, "AG9")
	if err != nil || recovery.LastFrame == nil || recovery.LastFrame.BetID != first.BetID || recovery.LastFrame.Balance != 499950 {
		t.Fatal("restart state", recovery, err)
	}
	if first.StepIndex != 1 || first.NextAction != "continue" || !hasAG9Symbol(first) {
		t.Fatal("first response must be the first played respin", first)
	}
	settled := []play.Frame{first}
	last := first
	frames := 1
	for last.NextAction != "complete" {
		last, err = s.Spin(ctx, session, "AG9", last.NextRequestID, 50)
		if err != nil {
			t.Fatal(err)
		}
		frames++
		settled = append(settled, last)
		if last.NextAction != "complete" && last.WinAmount != 0 {
			t.Fatal("early credit")
		}
	}
	if oldReader.calls.Load() != draws || newReader.calls.Load() != 0 || last.Balance != 499950+last.TotalWinAmount || last.WinAmount != last.TotalWinAmount {
		t.Fatal("redraw, version switch or duplicate credit", last)
	}
	replay, err := s.BetReplay(ctx, session, "AG9", first.BetID, 100, "")
	if err != nil || len(replay.Frames) != frames || len(replay.StartBoard) != 0 {
		t.Fatal("replay", replay, err)
	}
	for i, frame := range replay.Frames {
		if frame.StepIndex != i+1 || !reflect.DeepEqual(frame.Board, settled[i].Board) || frame.TotalWinAmount != settled[i].TotalWinAmount {
			t.Fatal("replay differs from the settled response", i)
		}
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
	rank, err := restarted.RankReplaySession(ctx, "AG9", first.BetID, session.Player.Subject.UID)
	if err != nil || rank.Player != session.Player {
		t.Fatal("rank replay", err)
	}
	share, err := s.CreateReplayShare(ctx, session, "AG9", first.BetID)
	if err != nil {
		t.Fatal(err)
	}
	public, err := s.SharedReplay(ctx, "AG9", first.BetID, share.ShareToken, 100, "")
	if err != nil || len(public.Frames) != frames || public.Frames[0].Balance != 0 || len(public.Frames[0].GameData) == 0 {
		t.Fatal("shared replay", public, err)
	}
	// The next paid spin selects the new version and exercises the actual HTTP
	// codec, including AG9-only gameData, on the same persisted player state.
	server := httptest.NewServer(httpapi.NewGameRouter(func() bool { return true }, s, []string{"http://localhost:5180"}, slog.New(slog.NewTextHandler(io.Discard, nil))))
	defer server.Close()
	body := `{"requestId":"` + last.NextRequestID + `","bet":"10","betLevel":1}`
	request, _ := http.NewRequestWithContext(ctx, "POST", server.URL+"/api/v1/games/AG9/spin", strings.NewReader(body))
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
		t.Fatal("AG9 HTTP/current version", response.Status, envelope)
	}
	id := envelope.Data.BetID
	nextReplay, err := s.BetReplay(ctx, session, "AG9", id, 100, "")
	if err != nil || !reflect.DeepEqual(nextReplay.StartBoard, last.Board) || len(nextReplay.Frames) != 1 {
		t.Fatal("second replay should start from the final board of the first bet", nextReplay, err)
	}
	nextShare, err := s.CreateReplayShare(ctx, session, "AG9", id)
	if err != nil {
		t.Fatal(err)
	}
	nextPublic, err := s.SharedReplay(ctx, "AG9", id, nextShare.ShareToken, 100, "")
	if err != nil || !reflect.DeepEqual(nextPublic.StartBoard, last.Board) || len(nextPublic.Frames) != 1 || nextPublic.Frames[0].Balance != 0 {
		t.Fatal("public replay should expose the preceding board only", nextPublic, err)
	}
}

func TestAG9AutoRoundIdempotency(t *testing.T) {
	store, _ := database(t)
	ctx := context.Background()
	module, reader := ag9Module(t, true)
	session := play.Session{Player: profile().Player(), GameID: "AG9", ExpiresAt: time.Now().Add(time.Hour)}
	if _, err := store.CreateSession(ctx, "ag9-auto", session, 500000); err != nil {
		t.Fatal(err)
	}
	s, err := play.NewLive(store, ag9Games{current: module}, ag9Policies(t), autoLauncher{})
	if err != nil {
		t.Fatal(err)
	}
	req := play.AutoRoundRequest{RequestID: "ag9-auto-1", UID: 1, GameID: "AG9", Bet: 10, BetLevel: 1, Country: "ID", Currency: "IDR"}
	first, err := s.AutoRound(ctx, req)
	if err != nil {
		t.Fatal(err)
	}
	draws := reader.calls.Load()
	again, err := s.AutoRound(ctx, req)
	if err != nil || first != again || reader.calls.Load() != draws {
		t.Fatal("auto duplicate", again, err)
	}
	replay, err := s.BetReplay(ctx, session, "AG9", first.BetID, 100, "")
	if err != nil || len(replay.Frames) < 2 {
		t.Fatal("auto replay", replay, err)
	}
	for i, f := range replay.Frames {
		if i < len(replay.Frames)-1 && f.WinAmount != 0 {
			t.Fatal("auto early credit")
		}
	}
}

func hasAG9Symbol(frame play.Frame) bool {
	for _, column := range frame.Board {
		for _, cell := range column {
			if cell.Symbol != 0 {
				return true
			}
		}
	}
	return false
}
