package postgres_test

import (
	"aislots/slots_service/internal/application/bet"
	"aislots/slots_service/internal/application/betlist"
	"aislots/slots_service/internal/application/play"
	"aislots/slots_service/internal/engine"
	"aislots/slots_service/internal/infrastructure/gamedata"
	"aislots/slots_service/internal/infrastructure/postgres"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"net/url"
	"os"
	"reflect"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func database(t *testing.T) (*postgres.Store, string) {
	t.Helper()
	dsn := os.Getenv("AISLOTS_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("AISLOTS_TEST_DATABASE_URL required for real PostgreSQL integration tests")
	}
	ctx := context.Background()
	admin, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	schema := "test_" + strings.ToLower(rand.Text())
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+pgx.Identifier{schema}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_, _ = admin.Exec(ctx, "DROP SCHEMA "+pgx.Identifier{schema}.Sanitize()+" CASCADE")
		_ = admin.Close(ctx)
	})
	u, err := url.Parse(dsn)
	if err != nil {
		t.Fatal(err)
	}
	q := u.Query()
	q.Set("search_path", schema)
	u.RawQuery = q.Encode()
	scoped := u.String()
	store, err := postgres.Open(ctx, scoped)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(store.Close)
	if err = store.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	if err = store.Migrate(ctx); err != nil {
		t.Fatal("idempotent migrations", err)
	}
	return store, scoped
}

type spinner struct {
	calls    atomic.Int64
	free     bool
	fail     bool
	fraction bool
	loss     bool
}

func (s *spinner) Type() string    { return "test_v1" }
func (s *spinner) Version() string { return "test_v1:fixture" }
func board(n int) engine.Board {
	return engine.Board{{{ID: n, Symbol: 1}}, {{ID: n + 1, Symbol: 1}}, {{ID: n + 2, Symbol: 1}}}
}
func (s *spinner) Spin(ctx context.Context, r engine.SpinRequest) (engine.SpinResult, error) {
	s.calls.Add(1)
	if s.fail {
		return engine.SpinResult{}, engine.ErrFill
	}
	state := r.State
	state.Version = s.Version()
	state.Sequence++
	mode := engine.Base
	stake := r.BetMinorUnits
	if state.Free != nil {
		copy := *state.Free
		state.Free = &copy
		mode = engine.Free
		stake = copy.BetMinorUnits
		state.Free.Remaining--
		if state.Free.Remaining == 0 {
			state.Free = nil
		}
	} else if s.free {
		state.Free = &engine.FreeSession{Remaining: 2, BetMinorUnits: stake}
	}
	result := engine.SpinResult{GameID: "AG1", Version: s.Version(), Mode: mode, BetMinorUnits: stake, ChargeMinorUnits: r.BetMinorUnits, WinMinorUnits: 30, ExactWinMinorUnits: "30", NextState: state, Round: engine.Round{Initial: board(1), Final: board(7), RawMultiplier: "6", Steps: []engine.Step{{Before: board(1), RawPayout: "2", Wins: []engine.Win{{CellIDs: []int{1, 2, 3}, Symbol: 1, Columns: 3, Ways: 1, RawPayout: "2"}}}, {Before: board(4), RawPayout: "4", Wins: []engine.Win{{CellIDs: []int{4, 5, 6}, Symbol: 1, Columns: 3, Ways: 1, RawPayout: "4"}}}}}}
	if s.fraction {
		result.WinMinorUnits = 1
		result.ExactWinMinorUnits = "1.5"
		result.Round.RawMultiplier = "2"
		result.Round.Steps[0].RawPayout = "1"
		result.Round.Steps[1].RawPayout = "1"
	}
	if s.loss {
		result.WinMinorUnits = 0
		result.ExactWinMinorUnits = "0"
		result.Round.RawMultiplier = "0"
		result.Round.Steps = nil
	}
	return result, nil
}

type games struct{ g bet.Spinner }

func (g games) Resolve(id, v string) (bet.Spinner, error) {
	if id != "AG1" || v != "" && v != g.g.Version() {
		return nil, bet.ErrGameUnavailable
	}
	return g.g, nil
}
func profile() play.TestProfile {
	return play.TestProfile{Enabled: true, AppName: "test-platform", AppKey: "test-app", UID: "test-user", Country: "ID", Currency: "IDR", InitialBalance: 500000}
}
func service(t *testing.T, store play.Store, g bet.Spinner) *play.Service {
	t.Helper()
	policies, err := betlist.New([]betlist.Policy{{GameID: "AG1", Country: "ID", Currency: "IDR", Amounts: []int64{100, 101}, Default: 100}})
	if err != nil {
		t.Fatal(err)
	}
	s, err := play.New(store, games{g}, policies, profile())
	if err != nil {
		t.Fatal(err)
	}
	return s
}
func login(t *testing.T, s *play.Service) (play.Session, play.LoginResponse) {
	t.Helper()
	r, err := s.Login(context.Background(), play.LoginRequest{Test: true, AppName: "test-platform", AppKey: "test-app", UID: "test-user", GameID: "AG1"})
	if err != nil {
		t.Fatal(err)
	}
	session, err := s.Authenticate(context.Background(), r.AccessToken)
	if err != nil {
		t.Fatal(err)
	}
	return session, r
}
func prepare(t *testing.T, s *play.Service, session play.Session) play.Prepared {
	t.Helper()
	p, err := s.Prepare(context.Background(), session, "AG1", 100)
	if err != nil {
		t.Fatal(err)
	}
	return p
}
func next(t *testing.T, s *play.Service, session play.Session, f play.Frame) play.Frame {
	t.Helper()
	if f.Next == nil {
		t.Fatal("missing next cursor")
	}
	r, err := s.Continue(context.Background(), session, "AG1", f.BetID, *f.Next)
	if err != nil {
		t.Fatal(err)
	}
	return r
}
func TestPostgresProgressiveIdempotencyAndRestart(t *testing.T) {
	store, dsn := database(t)
	g := &spinner{}
	s := service(t, store, g)
	session, u := login(t, s)
	if u.Balance != 500000 {
		t.Fatal(u.Balance)
	}
	p := prepare(t, s, session)
	again := prepare(t, s, session)
	if p.BetID != again.BetID {
		t.Fatal("prepare retry created new ID")
	}
	var wg sync.WaitGroup
	frames := make(chan play.Frame, 16)
	for i := 0; i < 16; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			f, err := s.Bet(context.Background(), session, "AG1", p.BetID)
			if err != nil {
				t.Error(err)
				return
			}
			frames <- f
		}()
	}
	wg.Wait()
	close(frames)
	var first play.Frame
	for f := range frames {
		if first.BetID == "" {
			first = f
		}
		if !reflect.DeepEqual(first, f) {
			t.Fatal("duplicate returned different result")
		}
	}
	if g.calls.Load() != 1 || first.WinAmount != 10 || first.Balance != 499910 || first.NextAction != "continue" {
		t.Fatal(first, g.calls.Load())
	}
	raw, _ := json.Marshal(first)
	if strings.Contains(string(raw), "nextState") || strings.Contains(string(raw), "\"after\"") || first.Board[0][0].ID != 1 {
		t.Fatal("future outcome leaked")
	}
	if _, err := s.Continue(context.Background(), session, "AG1", p.BetID, play.Cursor{SpinIndex: 0, StepIndex: 3}); !errors.Is(err, play.ErrConflict) {
		t.Fatal("skipped step accepted", err)
	}
	if _, err := s.Prepare(context.Background(), session, "AG1", 100); !errors.Is(err, play.ErrConflict) {
		t.Fatal("new paid bet during active chain")
	}
	store.Close()
	reopened, err := postgres.Open(context.Background(), dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	s = service(t, reopened, g)
	session, err = s.Authenticate(context.Background(), u.AccessToken)
	if err != nil {
		t.Fatal("session lost on reopen", err)
	}
	recovery, err := s.Recover(context.Background(), session, "AG1")
	if err != nil || recovery.Frame == nil || !reflect.DeepEqual(*recovery.Frame, first) {
		t.Fatal("progress lost", recovery, err)
	}
	second := next(t, s, session, first)
	if second.WinAmount != 20 || second.Balance != 499930 {
		t.Fatal(second)
	}
	duplicate, err := s.Continue(context.Background(), session, "AG1", p.BetID, *first.Next)
	if err != nil || !reflect.DeepEqual(second, duplicate) {
		t.Fatal("duplicate step changed")
	}
	last := next(t, s, session, second)
	if last.NextAction != "complete" || last.Board[0][0].ID != 7 || last.WinAmount != 0 {
		t.Fatal(last)
	}
	_, relogin := login(t, s)
	if relogin.Balance != 499930 {
		t.Fatal("login reset wallet", relogin)
	}
	inspected, err := s.Inspect(context.Background(), session, "AG1", p.BetID)
	if err != nil || inspected.Frame == nil || inspected.Frame.NextAction != "complete" {
		t.Fatal("lost final response cannot recover")
	}
	conn, err := pgx.Connect(context.Background(), dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(context.Background())
	var ledger int
	if err = conn.QueryRow(context.Background(), `SELECT count(*) FROM test_wallet_ledger`).Scan(&ledger); err != nil || ledger != 3 {
		t.Fatal("duplicate ledger", ledger, err)
	}
}
func TestPostgresFreeSpinsAndCumulativeRounding(t *testing.T) {
	for _, fraction := range []bool{false, true} {
		t.Run(map[bool]string{false: "free", true: "fraction"}[fraction], func(t *testing.T) {
			store, _ := database(t)
			g := &spinner{free: !fraction, fraction: fraction}
			s := service(t, store, g)
			session, _ := login(t, s)
			p := prepare(t, s, session)
			f, err := s.Bet(context.Background(), session, "AG1", p.BetID)
			if err != nil {
				t.Fatal(err)
			}
			if fraction && f.WinAmount != 0 {
				t.Fatal("rounded each step independently")
			}
			for n := 0; n < 20 && f.Next != nil; n++ {
				f = next(t, s, session, f)
			}
			if f.NextAction != "complete" {
				t.Fatal("free did not finish")
			}
			want := int64(499990)
			calls := int64(3)
			if fraction {
				want = 499901
				calls = 1
			}
			if f.Balance != want || g.calls.Load() != calls {
				t.Fatal("wrong balance", f, g.calls.Load())
			}
		})
	}
}
func TestPostgresErrorsRollbackAndOwnership(t *testing.T) {
	store, _ := database(t)
	g := &spinner{fail: true}
	s := service(t, store, g)
	session, _ := login(t, s)
	p := prepare(t, s, session)
	if _, err := s.Bet(context.Background(), session, "AG1", p.BetID); !errors.Is(err, engine.ErrFill) {
		t.Fatal(err)
	}
	_, u := login(t, s)
	if u.Balance != 500000 {
		t.Fatal("failed spin deducted")
	}
	g.fail = false
	other := session
	other.Player.Subject.UID = "other-user"
	if _, err := store.CreateSession(context.Background(), "other", other, 500000); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Bet(context.Background(), other, "AG1", p.BetID); !errors.Is(err, play.ErrNotFound) {
		t.Fatal("bet ownership not enforced", err)
	}
	if err := store.WithPlayer(context.Background(), session.Player, func(tx play.Tx) error {
		ticket, err := tx.Ticket(context.Background(), p.BetID)
		if err != nil {
			return err
		}
		ticket.ExpiresAt = time.Now().Add(-time.Minute)
		return tx.SaveTicket(context.Background(), ticket)
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Bet(context.Background(), session, "AG1", p.BetID); !errors.Is(err, play.ErrExpired) {
		t.Fatal(err)
	}
	if _, err := s.Login(context.Background(), play.LoginRequest{Test: false}); !errors.Is(err, play.ErrUnauthorized) {
		t.Fatal("production identity allowed into test wallet")
	}
}

func TestRealEngineProgressiveFreeChain(t *testing.T) {
	store, _ := database(t)
	game, err := gamedata.LoadGame("../../../testdata/integration/AG1")
	if err != nil {
		t.Fatal(err)
	}
	game.Board.ColumnHeights = []int{4, 4, 4, 4, 4}
	game.Parameters.BaseWin = 1
	game.Parameters.FreeWin = 1
	game.Parameters.FreeTrigger = 1
	game.Parameters.LossRule = nil
	game.Parameters.WinRule = nil
	game.Parameters.TriggerRule = nil
	cap := 0
	game.Parameters.RetriggerLimit = &cap
	game.Parameters.Awards = [][2]float64{{2, 1}}
	game.BaseRows = []engine.WeightRow{{"6", "1"}}
	game.FreeRows = []engine.WeightRow{{"12", "1"}}
	skeleton := []int{3, 0, 1, 4, 1, 8, 1, 3, 0, 1, 4, 1, 8, 1, 0}
	library := engine.NewMemoryLibrary(map[engine.Mode]map[string][][]int{engine.Base: {"6": {skeleton}}, engine.Free: {"12": {skeleton}}})
	actual, err := engine.NewEngine(game, library, engine.Options{TriggerSymbolCount: 3})
	if err != nil {
		t.Fatal(err)
	}
	s := service(t, store, actual)
	session, _ := login(t, s)
	progress, err := s.Status(context.Background(), session, "AG1")
	if err != nil {
		t.Fatal(err)
	}
	f, err := s.Spin(context.Background(), session, "AG1", progress.RequestID, 100)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(f.CascadeFactors, []string{"1", "2", "3", "5"}) || f.CascadeIndex != 0 {
		t.Fatal("wrong base multiplier presentation", f.CascadeFactors, f.CascadeIndex)
	}
	if f.PreviewRows != 1 {
		t.Fatal("missing preview metadata")
	}
	for _, col := range f.Board {
		if len(col) != 5 {
			t.Fatal("expected preview plus four active cells")
		}
	}
	if len(f.Board) != 5 || f.WinAmount != 10 || !f.TriggeredFree {
		t.Fatal("first real frame", f)
	}
	frames := 1
	for f.NextAction != "complete" {
		prior := f
		f, err = s.Spin(context.Background(), session, "AG1", f.NextRequestID, 100)
		if err != nil {
			t.Fatal(err)
		}
		if prior.SpinIndex == f.SpinIndex {
			for c, col := range prior.Board {
				removed := false
				for _, cell := range col[1:] {
					for _, id := range prior.RemovedIDs {
						if cell.ID == id {
							removed = true
						}
					}
				}
				if removed {
					found := false
					for _, cell := range f.Board[c][1:] {
						if cell == col[0] {
							found = true
						}
					}
					if !found {
						t.Fatal("preview did not enter next active board")
					}
				} else if col[0] != f.Board[c][0] {
					t.Fatal("preview changed without refill")
				}
			}
		}
		frames++
		if f.Mode == engine.Free && !reflect.DeepEqual(f.CascadeFactors, []string{"2", "4", "6", "10"}) {
			t.Fatal("free factors do not match game config", f.CascadeFactors)
		}
		if frames > 20 {
			t.Fatal("free loop did not end")
		}
	}
	if f.NextAction != "complete" || f.Balance != 500050 || f.TotalWinAmount != 150 || frames != 9 {
		t.Fatal("real free settlement mismatch", f, frames)
	}
}

func TestNewPaidTicketUsesCurrentVersionWithoutResettingState(t *testing.T) {
	store, _ := database(t)
	g := &spinner{loss: true}
	s := service(t, store, g)
	session, _ := login(t, s)
	prior := engine.State{Version: "retired_v1:old", Sequence: 12, Streak: -3, FreeMisses: 17, HasTriggeredFree: true}
	ctx := context.Background()
	if err := store.WithPlayer(ctx, session.Player, func(tx play.Tx) error { return tx.SaveState(ctx, "AG1", prior) }); err != nil {
		t.Fatal(err)
	}
	ticket := prepare(t, s, session)
	if err := store.WithPlayer(ctx, session.Player, func(tx play.Tx) error {
		saved, err := tx.Ticket(ctx, ticket.BetID)
		if err != nil {
			return err
		}
		if saved.Version != g.Version() {
			t.Fatalf("ticket version %s", saved.Version)
		}
		state, err := tx.State(ctx, "AG1")
		if err != nil {
			return err
		}
		if !reflect.DeepEqual(state, prior) {
			t.Fatalf("prepare changed state: %+v", state)
		}
		if tx.Balance() != 500000 {
			t.Fatal("prepare changed balance")
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Bet(ctx, session, "AG1", ticket.BetID); err != nil {
		t.Fatal(err)
	}
}
