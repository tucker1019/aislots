package postgres_test

import (
	"compress/gzip"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"aislots/slots_service/internal/application/betlist"
	"aislots/slots_service/internal/application/play"
	"aislots/slots_service/internal/infrastructure/lobby"
	"aislots/slots_service/internal/infrastructure/postgres"
	"github.com/jackc/pgx/v5"
)

func TestExperienceLossOmissionAndRestart(t *testing.T) {
	for _, tc := range []struct {
		name                    string
		omit, loss, free, crash bool
		saved                   bool
	}{
		{"experience-loss", true, true, false, false, false},
		{"ordinary-loss", false, true, false, false, true},
		{"experience-win", true, false, false, false, true},
		{"zero-free-chain", true, true, true, false, true},
		{"loss-checkpoint-crash", true, true, false, true, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			store, dsn := database(t)
			ctx := context.Background()
			session := play.Session{Player: profile().Player(), GameID: "AG1", ExpiresAt: time.Now().Add(time.Hour)}
			if _, err := store.CreateSession(ctx, "seed", session, 500000); err != nil {
				t.Fatal(err)
			}
			policies, err := betlist.New([]betlist.Policy{{GameID: "AG1", Country: "ID", Currency: "IDR", Amounts: []int64{100}, Default: 100, LineCount: 20, BetLevel: 1}})
			if err != nil {
				t.Fatal(err)
			}
			g := &spinner{loss: tc.loss, free: tc.free}
			var initial play.Store = store
			if tc.crash {
				initial = &interruptedAutoStore{Store: store}
			}
			s, err := play.NewLive(initial, games{g}, policies, autoLauncher{})
			if err != nil {
				t.Fatal(err)
			}
			r := play.AutoRoundRequest{RequestID: "round", UID: 1, GameID: "AG1", Bet: 100, BetLevel: 1, Country: "ID", Currency: "IDR", SkipZeroWinReplay: tc.omit}
			first, err := s.AutoRound(ctx, r)
			if tc.crash {
				if !errors.Is(err, context.DeadlineExceeded) {
					t.Fatal(err)
				}
			} else if err != nil {
				t.Fatal(err)
			}
			reopened, err := postgres.Open(ctx, dsn)
			if err != nil {
				t.Fatal(err)
			}
			defer reopened.Close()
			s, err = play.NewLive(reopened, games{g}, policies, autoLauncher{})
			if err != nil {
				t.Fatal(err)
			}
			got, err := s.AutoRound(ctx, r)
			if err != nil {
				t.Fatal(err)
			}
			if !tc.crash && got != first {
				t.Fatal("completed retry changed", got, first)
			}
			calls := int64(1)
			if tc.free {
				calls = 3
			}
			if g.calls.Load() != calls {
				t.Fatal("redrew on restart", g.calls.Load())
			}
			conn, err := pgx.Connect(ctx, dsn)
			if err != nil {
				t.Fatal(err)
			}
			defer conn.Close(ctx)
			var spins, frames, debits, tickets int
			if err = conn.QueryRow(ctx, `SELECT (SELECT count(*) FROM game_spins),(SELECT count(*) FROM spin_steps),(SELECT count(*) FROM test_wallet_ledger WHERE kind='debit'),(SELECT count(*) FROM bet_tickets)`).Scan(&spins, &frames, &debits, &tickets); err != nil {
				t.Fatal(err)
			}
			if debits != 1 || tickets != 1 || (tc.saved && (spins == 0 || frames == 0)) || (!tc.saved && (spins != 0 || frames != 0)) {
				t.Fatal("wrong storage or repeated debit", spins, frames, debits, tickets)
			}
			state, err := s.Status(ctx, session, "AG1")
			if err != nil || state.HasNext {
				t.Fatal(state, err)
			}
			if (state.LastFrame != nil) != tc.saved {
				t.Fatal("omitted frame exposed as real board", state)
			}
			_, err = s.BetReplay(ctx, session, "AG1", got.BetID, 100, "")
			if tc.saved && err != nil || !tc.saved && !errors.Is(err, play.ErrNotFound) {
				t.Fatal("replay policy", err)
			}
			if !tc.saved {
				var raw []byte
				if err = conn.QueryRow(ctx, `SELECT data FROM spin_request_receipts`).Scan(&raw); err != nil {
					t.Fatal(err)
				}
				var receipt struct {
					ReplayOmitted bool
					Frame         map[string]any
				}
				if err = json.Unmarshal(raw, &receipt); err != nil {
					t.Fatal(err)
				}
				if !receipt.ReplayOmitted || receipt.Frame["board"] != nil || receipt.Frame["gameData"] != nil || receipt.Frame["nextRequestId"] == "" {
					t.Fatal("replay payload retained or token lost", string(raw))
				}
			}
		})
	}
}

func TestExperienceLossHistoryCleanupPreservesMoneyRetryAndOtherRounds(t *testing.T) {
	store, dsn := database(t)
	ctx := context.Background()
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(ctx)
	// Several initial heap windows contain unrelated receipts. An empty window
	// must not terminate the scan before eligible experience history is reached.
	if _, err = conn.Exec(ctx, `INSERT INTO spin_request_receipts(scope,game_id,request_id,data) SELECT 'other-platform','AG1',n::text,'{}'::jsonb FROM generate_series(1,200) n`); err != nil {
		t.Fatal(err)
	}

	type round struct {
		session play.Session
		frame   play.Frame
		remove  bool
	}
	var rounds []round
	for _, tc := range []struct {
		uid                         string
		loss, free, legacy, pending bool
		remove                      bool
	}{
		{"experience", true, false, true, false, true},
		{"experience", true, false, false, false, true},
		{"experience", false, false, false, false, false},
		{"experience", true, true, false, false, false},
		{"real", true, false, false, false, false},
		{"busy-experience", true, false, false, true, false},
		{"busy-experience-old", true, false, false, true, true},
	} {
		session := play.Session{Player: profile().Player(), GameID: "AG1", ExpiresAt: time.Now().Add(time.Hour)}
		session.Player.Subject.UID = tc.uid
		if _, err = store.CreateSession(ctx, fmt.Sprintf("seed-%d", len(rounds)), session, 500000); err != nil {
			t.Fatal(err)
		}
		s := service(t, store, &spinner{loss: tc.loss, free: tc.free})
		state, e := s.Status(ctx, session, "AG1")
		if e != nil {
			t.Fatal(e)
		}
		f, e := s.Spin(ctx, session, "AG1", state.RequestID, 100)
		if e != nil {
			t.Fatal(e)
		}
		if tc.free {
			for f.NextAction != "complete" {
				f, e = s.Spin(ctx, session, "AG1", f.NextRequestID, 100)
				if e != nil {
					t.Fatal(e)
				}
			}
		}
		if tc.legacy {
			raw, _ := json.Marshal(play.SpinReceipt{Amount: 100, Frame: f})
			if _, e = conn.Exec(ctx, `UPDATE spin_request_receipts SET data=$2 WHERE request_id=$1`, f.RequestID, raw); e != nil {
				t.Fatal(e)
			}
		}
		if tc.pending {
			if _, e = conn.Exec(ctx, `INSERT INTO game_auto_rounds(appname,appkey,uid,game_id,request_id,amount,country,currency,spin_token) VALUES('test-platform','test-app',$1,'AG1','pending',100,'ID','IDR',$2)`, tc.uid, f.RequestID); e != nil {
				t.Fatal(e)
			}
		}
		if tc.pending && tc.remove {
			if _, e = conn.Exec(ctx, `UPDATE game_auto_rounds SET spin_token='unrelated-request' WHERE uid=$1`, tc.uid); e != nil {
				t.Fatal(e)
			}
		}
		rounds = append(rounds, round{session, f, tc.remove})
		if _, err = conn.Exec(ctx, `INSERT INTO spin_request_receipts(scope,game_id,request_id,data) SELECT 'other-platform','AG1',$1||'-'||n::text,'{}'::jsonb FROM generate_series(1,200) n`, fmt.Sprint(len(rounds))); err != nil {
			t.Fatal(err)
		}

	}
	// Simulate pre-upgrade duplicate orders. Cleanup changes only the ticket's
	// internal replay marker; future duplicate removal must still recognize it.
	if _, err = conn.Exec(ctx, `INSERT INTO bet_orders(bet_id,status,data) SELECT id,status,data FROM bet_tickets`); err != nil {
		t.Fatal(err)
	}
	var before, after string
	const money = `SELECT jsonb_agg(row_to_json(w) ORDER BY uid)::text FROM test_wallets w`
	if err = conn.QueryRow(ctx, money).Scan(&before); err != nil {
		t.Fatal(err)
	}
	backupDir := t.TempDir()
	var progress postgres.LossCleanupProgress
	run := func(apply bool) {
		t.Helper()
		progress = postgres.LossCleanupProgress{}
		err = store.ClearExperienceLossReplaysConcurrent(ctx, "test-platform", "test-app", []string{"experience", "busy-experience", "busy-experience-old"}, 2, 0, 3, apply, backupDir, func(p postgres.LossCleanupProgress) {
			progress.Eligible += p.Eligible
			progress.Frames += p.Frames
			progress.Receipts += p.Receipts
			progress.Tickets += p.Tickets
		})
		if err != nil {
			t.Fatal(err)
		}
	}
	run(false)
	if progress.Eligible != 3 || progress.Frames != 0 {
		t.Fatal("wrong dry run", progress)
	}
	// A failed backup must not modify any replay in its transaction.
	badBackup := filepath.Join(t.TempDir(), "file")
	if err = os.WriteFile(badBackup, []byte("not-a-directory"), 0600); err != nil {
		t.Fatal(err)
	}
	if err = store.ClearExperienceLossReplays(ctx, "test-platform", "test-app", []string{"experience"}, 2, 0, true, badBackup, nil); err == nil {
		t.Fatal("backup failure accepted")
	}
	run(true)
	if progress.Eligible != 3 || progress.Frames != 3 || progress.Receipts != 3 || progress.Tickets != 3 {
		t.Fatal("wrong apply", progress)
	}
	files, e := filepath.Glob(filepath.Join(backupDir, "loss-batch-*.jsonl.gz"))
	if e != nil || len(files) == 0 {
		t.Fatal("no batch backup", e)
	}
	backedUp := 0
	for _, path := range files {
		f, e := os.Open(path)
		if e != nil {
			t.Fatal(e)
		}
		gz, e := gzip.NewReader(f)
		if e != nil {
			t.Fatal(e)
		}
		dec := json.NewDecoder(gz)
		for {
			var row struct {
				Ticket  json.RawMessage
				Receipt json.RawMessage
				Frames  []json.RawMessage
				Spins   []json.RawMessage
			}
			e = dec.Decode(&row)
			if e == io.EOF {
				break
			}
			if e != nil {
				t.Fatal(e)
			}
			if len(row.Ticket) == 0 || len(row.Receipt) == 0 || len(row.Frames) != 1 || len(row.Spins) != 1 {
				t.Fatal("incomplete backup")
			}
			backedUp++
		}
		_ = gz.Close()
		_ = f.Close()
	}
	if backedUp != 3 {
		t.Fatal("wrong backup count", backedUp)
	}
	run(true)
	if progress.Eligible != 0 {
		t.Fatal("not idempotent", progress)
	}
	if result, e := store.RemoveDuplicateOrders(ctx, false); e != nil || !result.Exists {
		t.Fatal("replay marker broke duplicate recognition", result, e)
	}
	if err = conn.QueryRow(ctx, money).Scan(&after); err != nil || after != before {
		t.Fatal("money changed", err)
	}
	reopened, err := postgres.Open(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	for _, r := range rounds {
		s := service(t, reopened, &spinner{fail: true})
		got, e := s.Spin(ctx, r.session, "AG1", r.frame.RequestID, 100)
		if e != nil || got.BetID != r.frame.BetID || got.Balance != r.frame.Balance || got.NextRequestID != r.frame.NextRequestID {
			t.Fatal("retry lost after cleanup", got, e)
		}
		_, e = s.BetReplay(ctx, r.session, "AG1", r.frame.BetID, 100, "")
		if r.remove && !errors.Is(e, play.ErrNotFound) || !r.remove && e != nil {
			t.Fatal("wrong replay removed", r.frame.BetID, e)
		}
	}
}

func TestExperienceLossRecoversLostLobbySettlementResponse(t *testing.T) {
	store, dsn := database(t)
	ctx := context.Background()
	var mu sync.Mutex
	balance := int64(500000)
	debits := 0
	lost := false
	receipts := map[string]int64{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		var data any
		switch r.URL.Path {
		case "/internal/game/balance":
			data = map[string]any{"coins": balance}
		case "/internal/game/settle":
			var in lobby.Settlement
			if e := json.NewDecoder(r.Body).Decode(&in); e != nil {
				t.Error(e)
				w.WriteHeader(400)
				return
			}
			coins, exists := receipts[in.RequestID]
			if !exists {
				balance = balance - in.Debit + in.Credit
				coins = balance
				receipts[in.RequestID] = coins
				if in.Debit > 0 {
					debits++
				}
			}
			if !lost {
				lost = true
				w.WriteHeader(503)
				return
			}
			data = map[string]any{"coins": coins, "status": "confirmed"}
		default:
			w.WriteHeader(404)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"code": "OK", "data": data})
	}))
	defer server.Close()
	adapter, err := lobby.New(lobby.Config{URL: server.URL, AppName: "test-platform", AppKey: "test-app", GameID: "AG1"}, strings.Repeat("s", 32))
	if err != nil {
		t.Fatal(err)
	}
	policies, err := betlist.New([]betlist.Policy{{GameID: "AG1", Country: "ID", Currency: "IDR", Amounts: []int64{100}, Default: 100, LineCount: 20, BetLevel: 1}})
	if err != nil {
		t.Fatal(err)
	}
	g := &spinner{loss: true}
	newService := func(st *postgres.Store) *play.Service {
		st.UseLobby(adapter)
		s, e := play.NewLive(st, games{g}, policies, adapter)
		if e != nil {
			t.Fatal(e)
		}
		return s
	}
	s := newService(store)
	r := play.AutoRoundRequest{RequestID: "lost-response", UID: 1, GameID: "AG1", Bet: 100, BetLevel: 1, Country: "ID", Currency: "IDR", SkipZeroWinReplay: true}
	if _, err = s.AutoRound(ctx, r); err == nil {
		t.Fatal("unconfirmed round accepted")
	}
	reopened, err := postgres.Open(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	s = newService(reopened)
	out, err := s.AutoRound(ctx, r)
	if err != nil || out.Status != "complete" {
		t.Fatal(out, err)
	}
	mu.Lock()
	gotBalance, gotDebits := balance, debits
	mu.Unlock()
	if gotBalance != 498000 || gotDebits != 1 || g.calls.Load() != 1 {
		t.Fatal("money changed or redrew after lost response", gotBalance, gotDebits, g.calls.Load())
	}
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(ctx)
	var frames, spins, pending, statistics int
	if err = conn.QueryRow(ctx, `SELECT (SELECT count(*) FROM spin_steps),(SELECT count(*) FROM game_spins),(SELECT count(*) FROM lobby_pending_settlements),(SELECT count(*) FROM game_statistics_outbox)`).Scan(&frames, &spins, &pending, &statistics); err != nil || frames != 0 || spins != 0 || pending != 0 || statistics != 1 {
		t.Fatal("incorrect committed storage", frames, spins, pending, statistics, err)
	}
}
