package postgres_test

import (
	"aislots/slots_service/internal/application/betlist"
	"aislots/slots_service/internal/application/play"
	"aislots/slots_service/internal/domain/identity"
	"aislots/slots_service/internal/infrastructure/postgres"
	"context"
	"errors"
	"testing"
	"time"
)

type autoLauncher struct{}

func (autoLauncher) VerifyLaunch(context.Context, string, string, string) (identity.Context, int64, string, error) {
	return identity.Context{}, 0, "", play.ErrInvalid
}
func (autoLauncher) AutoPlayer(int64, string, string) (identity.Context, error) {
	return profile().Player(), nil
}
func TestAutoRoundIdempotencyFreeSpinsReplayAndRestart(t *testing.T) {
	store, dsn := database(t)
	ctx := context.Background()
	session := play.Session{Player: profile().Player(), GameID: "AG1", ExpiresAt: time.Now().Add(time.Hour)}
	if _, e := store.CreateSession(ctx, "auto-test", session, 500000); e != nil {
		t.Fatal(e)
	}
	policies, e := betlist.New([]betlist.Policy{{GameID: "AG1", Country: "ID", Currency: "IDR", Amounts: []int64{100}, Default: 100, LineCount: 20, BetLevel: 10}})
	if e != nil {
		t.Fatal(e)
	}
	spinner := &spinner{free: true}
	s, e := play.NewLive(store, games{spinner}, policies, autoLauncher{})
	if e != nil {
		t.Fatal(e)
	}
	r := play.AutoRoundRequest{RequestID: "whole-round-1", UID: 1, GameID: "AG1", Bet: 100, BetLevel: 1, Country: "ID", Currency: "IDR"}
	first, e := s.AutoRound(ctx, r)
	if e != nil {
		t.Fatal(e)
	}
	if first.Status != "complete" || first.BetID == "" || spinner.calls.Load() != 3 {
		t.Fatal(first, spinner.calls.Load())
	}
	restarted, e := postgres.Open(ctx, dsn)
	if e != nil {
		t.Fatal(e)
	}
	defer restarted.Close()
	s2, e := play.NewLive(restarted, games{spinner}, policies, autoLauncher{})
	if e != nil {
		t.Fatal(e)
	}
	replay, e := s2.AutoRound(ctx, r)
	if e != nil || replay != first || spinner.calls.Load() != 3 {
		t.Fatal(replay, e)
	}
	r.BetLevel = 2
	if _, e = s2.AutoRound(ctx, r); !errors.Is(e, play.ErrConflict) {
		t.Fatal("changed bet accepted", e)
	}
	history, e := s2.BetReplay(ctx, session, "AG1", first.BetID, 100, "")
	if e != nil || len(history.Frames) < 3 {
		t.Fatalf("replay missing: %+v %v", history, e)
	}
}

// Simulate a crash after a committed spin but before its next token is checkpointed.
type interruptedAutoStore struct {
	*postgres.Store
	interrupted bool
}

func (s *interruptedAutoStore) RunAutoRound(ctx context.Context, session play.Session, id string, amount int64, run func(*play.AutoRoundState, func() error) error) (play.AutoRoundReply, error) {
	return s.Store.RunAutoRound(ctx, session, id, amount, func(job *play.AutoRoundState, save func() error) error {
		return run(job, func() error {
			if job.BetID != "" && !s.interrupted {
				s.interrupted = true
				return context.DeadlineExceeded
			}
			return save()
		})
	})
}
func TestAutoRoundRecoversCommittedFrameBeforeCheckpoint(t *testing.T) {
	store, _ := database(t)
	ctx := context.Background()
	session := play.Session{Player: profile().Player(), GameID: "AG1", ExpiresAt: time.Now().Add(time.Hour)}
	if _, e := store.CreateSession(ctx, "checkpoint-test", session, 500000); e != nil {
		t.Fatal(e)
	}
	policies, e := betlist.New([]betlist.Policy{{GameID: "AG1", Country: "ID", Currency: "IDR", Amounts: []int64{100}, Default: 100, LineCount: 20, BetLevel: 10}})
	if e != nil {
		t.Fatal(e)
	}
	spinner := &spinner{free: true}
	interrupted := &interruptedAutoStore{Store: store}
	s, e := play.NewLive(interrupted, games{spinner}, policies, autoLauncher{})
	if e != nil {
		t.Fatal(e)
	}
	r := play.AutoRoundRequest{RequestID: "checkpoint-1", UID: 1, GameID: "AG1", Bet: 100, BetLevel: 1, Country: "ID", Currency: "IDR"}
	if _, e = s.AutoRound(ctx, r); !errors.Is(e, context.DeadlineExceeded) {
		t.Fatal(e)
	}
	if spinner.calls.Load() != 1 {
		t.Fatal("unexpected draws", spinner.calls.Load())
	}
	recovered, e := play.NewLive(store, games{spinner}, policies, autoLauncher{})
	if e != nil {
		t.Fatal(e)
	}
	out, e := recovered.AutoRound(ctx, r)
	if e != nil || out.BetID == "" || spinner.calls.Load() != 3 {
		t.Fatal(out, e, spinner.calls.Load())
	}
}

func TestAutoRoundSupportsSecondGameAndKeepsRetry(t *testing.T) {
	store, dsn := database(t)
	ctx := context.Background()
	session := play.Session{Player: profile().Player(), GameID: "AG2", ExpiresAt: time.Now().Add(time.Hour)}
	if _, err := store.CreateSession(ctx, "auto-ag2", session, 500000); err != nil {
		t.Fatal(err)
	}
	policies, err := betlist.New([]betlist.Policy{{GameID: "AG1", Country: "ID", Currency: "IDR", Amounts: []int64{100}, Default: 100, LineCount: 20, BetLevel: 10}, {GameID: "AG2", Country: "ID", Currency: "IDR", Amounts: []int64{100}, Default: 100, LineCount: 25, BetLevel: 10}})
	if err != nil {
		t.Fatal(err)
	}
	g := &spinner{free: true}
	s, err := play.NewLive(store, independentGames{g}, policies, autoLauncher{})
	if err != nil {
		t.Fatal(err)
	}
	request := play.AutoRoundRequest{RequestID: "ag2-round", UID: 1, GameID: "AG2", Bet: 100, BetLevel: 1, Country: "ID", Currency: "IDR"}
	policy, err := s.AutoBets(ctx, request)
	if err != nil || policy.LineCount != 25 {
		t.Fatal("second game policy", policy, err)
	}
	first, err := s.AutoRound(ctx, request)
	if err != nil || first.Status != "complete" || first.BetID == "" || g.calls.Load() != 3 {
		t.Fatal(first, err, g.calls.Load())
	}
	reopened, err := postgres.Open(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	s, err = play.NewLive(reopened, independentGames{g}, policies, autoLauncher{})
	if err != nil {
		t.Fatal(err)
	}
	repeated, err := s.AutoRound(ctx, request)
	if err != nil || repeated != first || g.calls.Load() != 3 {
		t.Fatal("retry changed settlement", repeated, err)
	}
	request.GameID = "MISSING"
	if _, err = s.AutoBets(ctx, request); err == nil {
		t.Fatal("unknown game accepted")
	}
}

func TestAutoRoundSupportsAG3AndKeepsRetry(t *testing.T) {
	store, dsn := database(t)
	ctx := context.Background()
	session := play.Session{Player: profile().Player(), GameID: "AG3", ExpiresAt: time.Now().Add(time.Hour)}
	if _, err := store.CreateSession(ctx, "auto-ag3", session, 500000); err != nil {
		t.Fatal(err)
	}
	policies, err := betlist.New([]betlist.Policy{{GameID: "AG1", Country: "ID", Currency: "IDR", Amounts: []int64{100}, Default: 100, LineCount: 20, BetLevel: 10}, {GameID: "AG3", Country: "ID", Currency: "IDR", Amounts: []int64{100}, Default: 100, LineCount: 20, BetLevel: 10}})
	if err != nil {
		t.Fatal(err)
	}
	g := &spinner{free: true}
	s, err := play.NewLive(store, independentGames{g}, policies, autoLauncher{})
	if err != nil {
		t.Fatal(err)
	}
	request := play.AutoRoundRequest{RequestID: "ag3-round", UID: 1, GameID: "AG3", Bet: 100, BetLevel: 1, Country: "ID", Currency: "IDR"}
	policy, err := s.AutoBets(ctx, request)
	if err != nil || policy.LineCount != 20 {
		t.Fatal("second game policy", policy, err)
	}
	first, err := s.AutoRound(ctx, request)
	if err != nil || first.Status != "complete" || first.BetID == "" || g.calls.Load() != 3 {
		t.Fatal(first, err, g.calls.Load())
	}
	reopened, err := postgres.Open(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	s, err = play.NewLive(reopened, independentGames{g}, policies, autoLauncher{})
	if err != nil {
		t.Fatal(err)
	}
	repeated, err := s.AutoRound(ctx, request)
	if err != nil || repeated != first || g.calls.Load() != 3 {
		t.Fatal("retry changed settlement", repeated, err)
	}
	request.GameID = "MISSING"
	if _, err = s.AutoBets(ctx, request); err == nil {
		t.Fatal("unknown game accepted")
	}
}
