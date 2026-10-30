package postgres_test

import (
	"aislots/slots_service/internal/application/play"
	"aislots/slots_service/internal/infrastructure/postgres"
	"context"
	"errors"
	"reflect"
	"sync"
	"testing"
)

func TestSingleSpinConcurrentRetryRestartAndReconnect(t *testing.T) {
	store, dsn := database(t)
	g := &spinner{}
	s := service(t, store, g)
	session, _ := login(t, s)
	ctx := context.Background()
	state, err := s.Status(ctx, session, "AG1")
	if err != nil || state.RequestID == "" || state.HasNext || state.LastFrame != nil {
		t.Fatal(state, err)
	}
	const count = 16
	results := make(chan play.Frame, count)
	failures := make(chan error, count)
	var wg sync.WaitGroup
	for i := 0; i < count; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			f, err := s.Spin(ctx, session, "AG1", state.RequestID, 100)
			results <- f
			failures <- err
		}()
	}
	wg.Wait()
	close(results)
	close(failures)
	for err := range failures {
		if err != nil {
			t.Fatal(err)
		}
	}
	var first play.Frame
	for frame := range results {
		if first.RequestID == "" {
			first = frame
		}
		if !reflect.DeepEqual(first, frame) {
			t.Fatal("duplicate request changed result")
		}
	}
	if first.SpinWinAmount != "10" {
		t.Fatal("future spin award exposed", first.SpinWinAmount)
	}
	if first.Balance != "499910" || first.StepIndex != 1 || first.Next != nil || g.calls.Load() != 1 {
		t.Fatal(first, g.calls.Load())
	}
	if _, err := s.Spin(ctx, session, "AG1", state.RequestID, 101); !errors.Is(err, play.ErrConflict) {
		t.Fatal("modified replay accepted", err)
	}
	if _, err := s.Spin(ctx, session, "AG1", "forged", 100); !errors.Is(err, play.ErrConflict) {
		t.Fatal("forged token accepted", err)
	}
	store.Close()
	reopened, err := postgres.Open(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(reopened.Close)
	s = service(t, reopened, g)
	// Refresh restores the last settled frame and exposes the next token without advancing.
	session, _ = login(t, s)
	state, err = s.Status(ctx, session, "AG1")
	if err != nil || !state.HasNext || state.RequestID != first.NextRequestID || state.Balance != first.Balance {
		t.Fatal(state, err)
	}
	if state.LastFrame == nil || !reflect.DeepEqual(*state.LastFrame, first) {
		t.Fatal("refresh did not restore last settled frame", state.LastFrame, first)
	}
	// Reading recovery repeatedly must not credit the same round or advance the token.
	repeated, err := s.Status(ctx, session, "AG1")
	if err != nil || !reflect.DeepEqual(repeated, state) || g.calls.Load() != 1 {
		t.Fatal("recovery advanced settlement", repeated, state, err)
	}
	if _, err := s.Spin(ctx, session, "AG1", state.RequestID, 101); !errors.Is(err, play.ErrConflict) {
		t.Fatal("changed active stake accepted", err)
	}
	second, err := s.Spin(ctx, session, "AG1", state.RequestID, 100)
	if err != nil || second.StepIndex != 2 || second.Balance != "499930" {
		t.Fatal(second, err)
	}
	recovered, err := s.Status(ctx, session, "AG1")
	if err != nil || recovered.LastFrame == nil || recovered.LastFrame.TotalWinAmount != "30" || recovered.LastFrame.WinAmount != "20" || recovered.Balance != "499930" || recovered.RequestID != second.NextRequestID {
		t.Fatal("a+b recovery lost cumulative win or changed wallet", recovered, err)
	}
	final, err := s.Spin(ctx, session, "AG1", second.NextRequestID, 100)
	if err != nil || final.NextAction != "complete" {
		t.Fatal(final, err)
	}
	state, err = s.Status(ctx, session, "AG1")
	if err != nil || state.HasNext || state.Balance != "499930" {
		t.Fatal(state, err)
	}
	if state.LastFrame == nil || !reflect.DeepEqual(*state.LastFrame, final) {
		t.Fatal("completed bet lost its settled display snapshot", state.LastFrame, final)
	}
	replay, err := s.Spin(ctx, session, "AG1", first.RequestID, 100)
	if err != nil || !reflect.DeepEqual(first, replay) {
		t.Fatal("old receipt changed", err)
	}
	// Completed retry cannot debit a second bet. Only a fresh token starts another stake.
	next, err := s.Spin(ctx, session, "AG1", state.RequestID, 100)
	if err != nil || next.BetID == first.BetID || next.Balance != "499840" {
		t.Fatal(next, err)
	}
}

func TestSingleSpinFreeAndRollback(t *testing.T) {
	store, _ := database(t)
	g := &spinner{free: true}
	s := service(t, store, g)
	session, _ := login(t, s)
	ctx := context.Background()
	state, err := s.Status(ctx, session, "AG1")
	if err != nil {
		t.Fatal(err)
	}
	token := state.RequestID
	frames := 0
	var last play.Frame
	for {
		f, err := s.Spin(ctx, session, "AG1", token, 100)
		if err != nil {
			t.Fatal(err)
		}
		recovered, err := s.Status(ctx, session, "AG1")
		if err != nil || recovered.LastFrame == nil || !reflect.DeepEqual(*recovered.LastFrame, f) || recovered.RequestID != f.NextRequestID {
			t.Fatal("free/cascade recovery differs from settled receipt", recovered, f, err)
		}
		frames++
		last = f
		token = f.NextRequestID
		if f.NextAction == "complete" {
			break
		}
		if frames > 20 {
			t.Fatal("endless free")
		}
	}
	if frames != 9 || last.Balance != "499990" || g.calls.Load() != 3 {
		t.Fatal(frames, last, g.calls.Load())
	}
	g.fail = true
	before, err := s.Status(ctx, session, "AG1")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = s.Spin(ctx, session, "AG1", before.RequestID, 100); err == nil {
		t.Fatal("expected engine error")
	}
	after, err := s.Status(ctx, session, "AG1")
	if err != nil || !reflect.DeepEqual(after, before) {
		t.Fatal("failed request consumed token or money", after, before, err)
	}
	g.fail = false
	if _, err = s.Spin(ctx, session, "AG1", before.RequestID, 100); err != nil {
		t.Fatal("retry after rollback failed", err)
	}
}

func TestSingleSpinContinuesExistingLegacyBet(t *testing.T) {
	store, _ := database(t)
	g := &spinner{}
	s := service(t, store, g)
	session, _ := login(t, s)
	ctx := context.Background()
	prepared := prepare(t, s, session)
	first, err := s.Bet(ctx, session, "AG1", prepared.BetID)
	if err != nil {
		t.Fatal(err)
	}
	status, err := s.Status(ctx, session, "AG1")
	if err != nil || !status.HasNext {
		t.Fatal(status, err)
	}
	next, err := s.Spin(ctx, session, "AG1", status.RequestID, 100)
	if err != nil || next.BetID != first.BetID || next.StepIndex != 2 || next.Balance != "499930" || g.calls.Load() != 1 {
		t.Fatal(next, err)
	}
}
