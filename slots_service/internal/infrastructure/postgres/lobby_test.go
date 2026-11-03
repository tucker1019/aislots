package postgres_test

import (
	"aislots/slots_service/internal/application/betlist"
	"aislots/slots_service/internal/application/play"
	"aislots/slots_service/internal/infrastructure/lobby"
	"aislots/slots_service/internal/infrastructure/postgres"
	"aislots/slots_service/internal/transport/httpapi"
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

func TestLobbySettlementRecoversLostResponseWithoutRedrawing(t *testing.T) {
	store, dsn := database(t)
	ctx := context.Background()
	balance := int64(1000)
	receipts := map[string]map[string]any{}
	lost := true
	rejectNext := false
	var mu sync.Mutex
	debits := 0
	var completions []lobby.Completion
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+strings.Repeat("s", 32) {
			w.WriteHeader(401)
			return
		}
		mu.Lock()
		defer mu.Unlock()
		var data any
		switch r.URL.Path {
		case "/internal/game/complete":
			var in lobby.Completion
			if e := json.NewDecoder(r.Body).Decode(&in); e != nil {
				t.Error(e)
				return
			}
			completions = append(completions, in)
			if len(completions) == 1 {
				w.WriteHeader(503)
				return
			}
			data = map[string]any{"included": true}
		case "/internal/game/exchange":
			data = map[string]any{"uid": 1, "appname": "lobby", "appkey": "web", "country": "ID", "currency": "IDR", "coins": balance}
		case "/internal/game/balance":
			data = map[string]any{"coins": balance}
		case "/internal/game/settle":
			var in lobby.Settlement
			if e := json.NewDecoder(r.Body).Decode(&in); e != nil {
				t.Error(e)
				return
			}
			if old, ok := receipts[in.RequestID]; ok {
				data = old
				break
			}
			if rejectNext {
				balance = 0
				rejectNext = false
			}
			if balance < in.Debit {
				data = map[string]any{"coins": balance, "status": "rejected"}
			} else {
				if lost {
					balance += 50
				} // Concurrent lobby recharge after the game fetched its balance.
				balance = balance - in.Debit + in.Credit
				if in.Debit > 0 {
					debits++
				}
				data = map[string]any{"coins": balance, "status": "confirmed"}
			}
			receipts[in.RequestID] = data.(map[string]any)
			// The lobby committed money, but its HTTP response was lost.
			if lost {
				lost = false
				w.WriteHeader(503)
				return
			}
		default:
			w.WriteHeader(404)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"code": "OK", "data": data})
	}))
	defer server.Close()
	adapter, e := lobby.New(lobby.Config{URL: server.URL, AppName: "lobby", AppKey: "web", GameID: "AG1"}, strings.Repeat("s", 32))
	if e != nil {
		t.Fatal(e)
	}
	policies, e := betlist.New([]betlist.Policy{{GameID: "AG1", Country: "ID", Currency: "IDR", Amounts: []int64{100}, Default: 100}})
	if e != nil {
		t.Fatal(e)
	}
	engine := &spinner{free: true}
	newService := func(st *postgres.Store) *play.Service {
		st.UseLobby(adapter)
		s, e := play.NewLive(st, games{engine}, policies, adapter)
		if e != nil {
			t.Fatal(e)
		}
		return s
	}
	service := newService(store)
	request := play.LoginRequest{GameID: "AG1", LaunchTicket: strings.Repeat("t", 52), ExchangeID: strings.Repeat("e", 16)}
	login, e := service.Login(ctx, request)
	if e != nil {
		t.Fatal(e)
	}
	same, e := service.Login(ctx, request)
	if e != nil || same.AccessToken != login.AccessToken {
		t.Fatal("login retry changed session", e)
	}
	session, e := service.Authenticate(ctx, login.AccessToken)
	if e != nil {
		t.Fatal(e)
	}
	state, e := service.Status(ctx, session, "AG1")
	if e != nil {
		t.Fatal(e)
	}
	if _, e = service.Spin(ctx, session, "AG1", state.RequestID, 100); e == nil {
		t.Fatal("unconfirmed response presented")
	}
	if balance != 960 || engine.calls.Load() != 1 {
		t.Fatal(balance, engine.calls.Load())
	}
	inspect, e := pgx.Connect(ctx, dsn)
	if e != nil {
		t.Fatal(e)
	}
	defer inspect.Close(ctx)
	var count int
	if e = inspect.QueryRow(ctx, `SELECT count(*) FROM spin_steps`).Scan(&count); e != nil || count != 0 {
		t.Fatal("unsettled frame committed", count, e)
	}
	// A new store and service simulate restart; the durable intent must contain the original drawn result.
	restarted, e := postgres.Open(ctx, dsn)
	if e != nil {
		t.Fatal(e)
	}
	defer restarted.Close()
	service = newService(restarted)
	// Even after a confirmed lobby receipt, a failed local commit must retain the intent.
	if _, e = inspect.Exec(ctx, `CREATE FUNCTION block_frame() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated local write failure'; END $$; CREATE TRIGGER block_frame BEFORE INSERT ON spin_steps FOR EACH ROW EXECUTE FUNCTION block_frame()`); e != nil {
		t.Fatal(e)
	}
	if _, e = service.Status(ctx, session, "AG1"); e == nil {
		t.Fatal("failed local commit was hidden")
	}
	if balance != 960 || engine.calls.Load() != 1 {
		t.Fatal("local failure redrew or charged again")
	}
	if _, e = inspect.Exec(ctx, `DROP TRIGGER block_frame ON spin_steps`); e != nil {
		t.Fatal(e)
	}
	recovered, e := service.Status(ctx, session, "AG1")
	if e != nil || recovered.LastFrame == nil || recovered.LastFrame.WinAmount != 10 || recovered.Balance != 960 {
		t.Fatal(recovered, e)
	}
	duplicate, e := service.Spin(ctx, session, "AG1", state.RequestID, 100)
	if e != nil || duplicate.BetID != recovered.LastFrame.BetID || duplicate.Balance != 960 {
		t.Fatal(duplicate, e)
	}
	frame := duplicate
	steps := 1
	for frame.NextAction != "complete" {
		frame, e = service.Spin(ctx, session, "AG1", frame.NextRequestID, 100)
		if e != nil {
			t.Fatal(e)
		}
		steps++
		if steps > 20 {
			t.Fatal("never completed")
		}
	}
	if steps != 9 || balance != 1040 || frame.TotalWinAmount != 90 || engine.calls.Load() != 3 || debits != 1 {
		t.Fatal(fmt.Sprint("bad free settlement ", steps, " ", balance, " ", frame.TotalWinAmount, " ", debits))
	}

	beforeReplay, err := service.Status(ctx, session, "AG1")
	if err != nil {
		t.Fatal(err)
	}
	replayServer := httptest.NewServer(httpapi.NewGameRouter(func() bool { return true }, service, nil, slog.New(slog.NewTextHandler(io.Discard, nil)), strings.Repeat("s", 32)))
	defer replayServer.Close()
	req, _ := http.NewRequest("POST", replayServer.URL+"/internal/rank-replay", strings.NewReader(fmt.Sprintf(`{"uid":1,"gameId":"AG1","betId":%q}`, frame.BetID)))
	req.Header.Set("Authorization", "Bearer "+strings.Repeat("s", 32))
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	var shared struct{ Data play.ReplayShare }
	err = json.NewDecoder(res.Body).Decode(&shared)
	res.Body.Close()
	if err != nil || res.StatusCode != 200 || len(shared.Data.ShareToken) != 52 {
		t.Fatal("rank replay bridge", res.StatusCode, err)
	}
	public, err := service.SharedReplay(ctx, "AG1", frame.BetID, shared.Data.ShareToken, 100, "")
	if err != nil || len(public.Frames) != steps {
		t.Fatal("whole rank replay", len(public.Frames), err)
	}
	for _, f := range public.Frames {
		if f.Balance != 0 {
			t.Fatal("replay disclosed balance")
		}
	}
	afterReplay, err := service.Status(ctx, session, "AG1")
	if err != nil || afterReplay.RequestID != beforeReplay.RequestID || afterReplay.Balance != beforeReplay.Balance {
		t.Fatal("replay changed live game", err)
	}
	if _, err = service.RankReplay(ctx, "AG1", frame.BetID, "2"); err == nil {
		t.Fatal("rank replay owner bypass")
	}

	// The free chain emits one durable completion; lost acknowledgement is retried after reopening the store.
	if e = restarted.FlushStatistics(ctx); e == nil {
		t.Fatal("expected failed acknowledgement")
	}
	worker, e := postgres.Open(ctx, dsn)
	if e != nil {
		t.Fatal(e)
	}
	defer worker.Close()
	worker.UseLobby(adapter)
	if e = worker.FlushStatistics(ctx); e != nil {
		t.Fatal(e)
	}
	if len(completions) != 2 || completions[0] != completions[1] || completions[0].Sequence != 1 || completions[0].BetAmount != 100 || completions[0].WinAmount != 90 {
		t.Fatal("wrong whole-bet statistics", completions)
	}
	if e = worker.FlushStatistics(ctx); e != nil || len(completions) != 2 {
		t.Fatal("completion delivered after acknowledgement", e)
	}
	if e = inspect.QueryRow(ctx, `SELECT count(*) FROM test_wallets`).Scan(&count); e != nil || count != 0 {
		t.Fatal("real user entered test wallet", count, e)
	}
	if e = inspect.QueryRow(ctx, `SELECT count(*) FROM lobby_pending_settlements`).Scan(&count); e != nil || count != 0 {
		t.Fatal("unfinished intent", count, e)
	}
	// Another wallet action can spend funds after the game's balance read. A definite rejection must allow a new funded attempt.
	status, e := service.Status(ctx, session, "AG1")
	if e != nil {
		t.Fatal(e)
	}
	rejectNext = true
	if _, e = service.Spin(ctx, session, "AG1", status.RequestID, 100); e != play.ErrFunds {
		t.Fatal("expected funds rejection", e)
	}
	balance = 1000
	if _, e = service.Spin(ctx, session, "AG1", status.RequestID, 100); e != nil {
		t.Fatal("rejected intent blocked a later funded retry", e)
	}
	if debits != 2 || balance != 910 {
		t.Fatal("rejected round posted funds", debits, balance)
	}

}
