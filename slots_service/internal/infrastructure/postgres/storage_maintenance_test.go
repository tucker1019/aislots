package postgres_test

import (
	"aislots/slots_service/internal/application/play"
	"aislots/slots_service/internal/infrastructure/postgres"
	"context"
	"encoding/json"
	"reflect"
	"testing"

	"github.com/jackc/pgx/v5"
)

func TestReceiptHistoryCompactionMixedRestartAndOrderRemoval(t *testing.T) {
	store, dsn := database(t)
	ctx := context.Background()
	g := &spinner{free: true}
	s := service(t, store, g)
	session, _ := login(t, s)
	state, err := s.Status(ctx, session, "AG1")
	if err != nil {
		t.Fatal(err)
	}
	var frames []play.Frame
	token := state.RequestID
	for len(frames) < 4 {
		frame, err := s.Spin(ctx, session, "AG1", token, 100)
		if err != nil {
			t.Fatal(err)
		}
		frames = append(frames, frame)
		token = frame.NextRequestID
	}
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(ctx)
	var count int
	if err = conn.QueryRow(ctx, `SELECT count(*) FROM bet_orders`).Scan(&count); err != nil || count != 0 {
		t.Fatal("duplicate orders still written", count, err)
	}
	var compact bool
	if err = conn.QueryRow(ctx, `SELECT bool_and(data->>'StorageVersion'='1' AND NOT (data->'Frame' ? 'board')) FROM spin_request_receipts`).Scan(&compact); err != nil || !compact {
		t.Fatal("full frame still duplicated", err)
	}
	// Restore three legacy receipts, leaving a fourth in the new format.
	for i, frame := range frames[:3] {
		if i == 0 {
			// A historical response can have a different balance from spin_steps.
			frame.Balance += 50
			frames[i] = frame
		}
		raw, _ := json.Marshal(play.SpinReceipt{BuyMode: 1, Amount: 100, Frame: frame})
		if i == 1 {
			// Nonmatching frame content must remain legacy, not be discarded.
			var obj map[string]json.RawMessage
			_ = json.Unmarshal(raw, &obj)
			var f map[string]json.RawMessage
			_ = json.Unmarshal(obj["Frame"], &f)
			f["historicalExtension"] = json.RawMessage(`42`)
			obj["Frame"], _ = json.Marshal(f)
			raw, _ = json.Marshal(obj)
		}
		if _, err = conn.Exec(ctx, `UPDATE spin_request_receipts SET data=$2 WHERE request_id=$1`, frame.RequestID, raw); err != nil {
			t.Fatal(err)
		}
	}
	if _, err = conn.Exec(ctx, `INSERT INTO spin_request_receipts(scope,game_id,request_id,data) VALUES('minimal-experience','AG1','omitted','{"ReplayOmitted":true,"Amount":100,"Frame":{"betId":"omitted","nextAction":"complete"}}'::jsonb)`); err != nil {
		t.Fatal(err)
	}
	var totals postgres.ReceiptCompactionProgress
	collect := func(p postgres.ReceiptCompactionProgress) {
		totals.Scanned += p.Scanned
		totals.Eligible += p.Eligible
		totals.Compacted += p.Compacted
		totals.Skipped += p.Skipped
		totals.BeforeJSONBytes += p.BeforeJSONBytes
		totals.AfterJSONBytes += p.AfterJSONBytes
	}
	if err = store.CompactReceiptHistory(ctx, 1, 0, false, collect); err != nil {
		t.Fatal(err)
	}
	if totals.Scanned != 3 || totals.Eligible != 2 || totals.Skipped != 1 || totals.Compacted != 0 || totals.AfterJSONBytes >= totals.BeforeJSONBytes {
		t.Fatal("incorrect dry run", totals)
	}
	if err = conn.QueryRow(ctx, `SELECT count(*) FROM spin_request_receipts WHERE data->>'StorageVersion'='1'`).Scan(&count); err != nil || count != 1 {
		t.Fatal("dry run changed storage", count, err)
	}
	totals = postgres.ReceiptCompactionProgress{}
	if err = store.CompactReceiptHistory(ctx, 1, 0, true, collect); err != nil || totals.Compacted != 2 || totals.Skipped != 1 {
		t.Fatal(totals, err)
	}
	if _, err = conn.Exec(ctx, `INSERT INTO bet_orders(bet_id,status,data) SELECT id,status,data FROM bet_tickets`); err != nil {
		t.Fatal(err)
	}
	if _, err = conn.Exec(ctx, `UPDATE bet_orders SET data=data || '{"unknown":1}'::jsonb`); err != nil {
		t.Fatal(err)
	}
	if _, err = store.RemoveDuplicateOrders(ctx, true); err == nil {
		t.Fatal("unmatched orders removed")
	}
	if _, err = conn.Exec(ctx, `UPDATE bet_orders o SET data=t.data FROM bet_tickets t WHERE t.id=o.bet_id`); err != nil {
		t.Fatal(err)
	}
	if result, err := store.RemoveDuplicateOrders(ctx, false); err != nil || !result.Exists || result.Removed {
		t.Fatal(result, err)
	}
	if result, err := store.RemoveDuplicateOrders(ctx, true); err != nil || !result.Removed {
		t.Fatal(result, err)
	}
	// Startup must not recreate the removed table from applied migrations.
	if err = store.Migrate(ctx); err != nil {
		t.Fatal(err)
	}
	store.Close()
	reopened, err := postgres.Open(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	s = service(t, reopened, g)
	for _, frame := range frames {
		got, err := s.Spin(ctx, session, "AG1", frame.RequestID, 100)
		if err != nil || !reflect.DeepEqual(got, frame) {
			t.Fatal("mixed old/new retry changed after restart", got, frame, err)
		}
	}
	state, err = s.Status(ctx, session, "AG1")
	if err != nil || state.LastFrame == nil || !reflect.DeepEqual(*state.LastFrame, frames[3]) {
		t.Fatal("recovery changed after compaction", state, err)
	}
	frame, err := s.Spin(ctx, session, "AG1", state.RequestID, 100)
	if err != nil || frame.StepIndex != 2 || g.calls.Load() != 2 {
		t.Fatal("continuation redrew or depended on orders", frame, err)
	}
	if _, err = s.BetReplay(ctx, session, "AG1", frame.BetID, 100, ""); err != nil {
		t.Fatal("replay failed after compaction", err)
	}
}
