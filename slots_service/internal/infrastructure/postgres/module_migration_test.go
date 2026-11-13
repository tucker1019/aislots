package postgres_test

import (
	"context"
	"encoding/json"
	"testing"

	"aislots/slots_service/internal/application/play"
	"aislots/slots_service/internal/infrastructure/postgres"
	"github.com/jackc/pgx/v5"
)

// Simulate a deployment while a historical Ways spin is only partly credited.
// Restore old result/state JSON, then reopen the store and continue the same bet.
func TestLegacyWaysStoredSpinAndStateResume(t *testing.T) {
	store, dsn := database(t)
	ctx := context.Background()
	source := &spinner{free: true}
	service1 := service(t, store, source)
	session, _ := login(t, service1)
	ticket := prepare(t, service1, session)
	first, err := service1.Bet(ctx, session, "AG1", ticket.BetID)
	if err != nil {
		t.Fatal(err)
	}
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(ctx)
	var raw []byte
	if err = conn.QueryRow(ctx, `SELECT data FROM game_spins WHERE bet_id=$1 AND spin_index=0`, ticket.BetID).Scan(&raw); err != nil {
		t.Fatal(err)
	}
	var saved play.StoredSpin
	if err = json.Unmarshal(raw, &saved); err != nil {
		t.Fatal(err)
	}
	amounts := make([]int64, len(saved.Result.Frames)-1)
	for i := range amounts {
		amounts[i] = saved.Result.Frames[i].WinMinorUnits
	}
	legacy, _ := json.Marshal(struct {
		Result      json.RawMessage
		StepAmounts []int64
	}{saved.Result.Payload, amounts})
	if _, err = conn.Exec(ctx, `UPDATE game_spins SET data=$2 WHERE bet_id=$1 AND spin_index=0`, ticket.BetID, legacy); err != nil {
		t.Fatal(err)
	}
	store.Close()
	restarted, err := postgres.Open(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer restarted.Close()
	service2 := service(t, restarted, source)
	frame, err := service2.Continue(ctx, session, "AG1", ticket.BetID, *first.Next)
	if err != nil {
		t.Fatal(err)
	}
	frame, err = service2.Continue(ctx, session, "AG1", ticket.BetID, *frame.Next)
	if err != nil {
		t.Fatal(err)
	}
	if frame.NextAction != "start_free" || source.calls.Load() != 1 || frame.Balance != 499930 {
		t.Fatal("redrew or recredited old spin", frame, source.calls.Load())
	}
	// A completed paid rotation has saved its bonus state; convert that state
	// back to the historical JSON shape before starting the next free rotation.
	if _, err = conn.Exec(ctx, `UPDATE player_game_states SET data=data->'payload' WHERE game_id='AG1'`); err != nil {
		t.Fatal(err)
	}
	frame, err = service2.Continue(ctx, session, "AG1", ticket.BetID, *frame.Next)
	if err != nil {
		t.Fatal(err)
	}
	if string(frame.Mode) != "free" || source.calls.Load() != 2 || frame.Balance != 499940 {
		t.Fatal("old state did not resume", frame)
	}
	again, err := service2.Continue(ctx, session, "AG1", ticket.BetID, play.Cursor{SpinIndex: frame.SpinIndex, StepIndex: frame.StepIndex})
	if err != nil || again.WinAmount != frame.WinAmount || again.Balance != frame.Balance || source.calls.Load() != 2 {
		t.Fatal("retry changed stored outcome", again, err)
	}
	_, replay, err := restarted.ReadBetReplay(ctx, session.Player, "AG1", ticket.BetID, play.ReplayQuery{AfterSpin: -1, AfterStep: 0, Limit: 100})
	if err != nil || len(replay) != 4 {
		t.Fatal("legacy/new mixed replay", len(replay), err)
	}
}
