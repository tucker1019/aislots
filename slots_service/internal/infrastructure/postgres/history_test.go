package postgres_test

import (
	"aislots/slots_service/internal/application/play"
	"aislots/slots_service/internal/transport/httpapi"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
)

// HTTP + 真数据库：记录按整局聚合，读取不能推进结算或泄漏未来盘面。
func TestBetHistoryWholeFreeBetReplayReadOnly(t *testing.T) {
	store, _ := database(t)
	s := service(t, store, &spinner{free: true})
	session, loginResponse := login(t, s)
	server := httptest.NewServer(httpapi.NewGameRouter(func() bool { return true }, s, nil, slog.New(slog.NewTextHandler(io.Discard, nil))))
	defer server.Close()
	get := func(path, token string, want int) map[string]json.RawMessage {
		t.Helper()
		req, _ := http.NewRequest(http.MethodGet, server.URL+path, nil)
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		response, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		raw, _ := io.ReadAll(response.Body)
		if response.StatusCode != want {
			t.Fatalf("%s: got %d want %d: %s", path, response.StatusCode, want, raw)
		}
		var env struct{ Data map[string]json.RawMessage }
		if err = json.Unmarshal(raw, &env); err != nil {
			t.Fatal(err)
		}
		return env.Data
	}
	const records = "/api/v1/games/AG1/bet-records"
	get(records, "", 401)
	empty := get(records, loginResponse.AccessToken, 200)
	if !bytes.Equal(empty["items"], []byte("[]")) {
		t.Fatal("new user has records", empty)
	}
	prepared := prepare(t, s, session)
	empty = get(records, loginResponse.AccessToken, 200)
	if string(empty["items"]) != "[]" {
		t.Fatal("unplaced bet appeared in history")
	}
	get(records+"/"+prepared.BetID+"/replay", loginResponse.AccessToken, 404)
	state, err := s.Status(context.Background(), session, "AG1")
	if err != nil {
		t.Fatal(err)
	}
	first, err := s.Spin(context.Background(), session, "AG1", state.RequestID, 100)
	if err != nil {
		t.Fatal(err)
	}
	list := get(records, loginResponse.AccessToken, 200)
	if string(list["summary"]) == "" {
		t.Fatal("missing filtered totals")
	}

	var items []struct{ BetID, GameID, BetAmount, TotalWinAmount, Status string }
	if err = json.Unmarshal(list["items"], &items); err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].BetID != first.BetID || items[0].BetAmount != "100" || items[0].TotalWinAmount != "10" || items[0].Status != "active" {
		t.Fatal("wrong active whole-bet summary", items)
	}
	replayPath := records + "/" + first.BetID + "/replay"
	replay := get(replayPath, loginResponse.AccessToken, 200)
	var frames []map[string]json.RawMessage
	if err = json.Unmarshal(replay["frames"], &frames); err != nil || len(frames) != 1 {
		t.Fatal("unsettled future results exposed", len(frames), err)
	}
	if string(frames[0]["winAmount"]) != `10` || string(frames[0]["stepIndex"]) != "1" {
		t.Fatal(frames)
	}
	var payouts []struct {
		Amount string `json:"amount"`
	}
	_ = json.Unmarshal(frames[0]["payouts"], &payouts)
	if len(payouts) != 1 || payouts[0].Amount != "10" || string(frames[0]["chargeAmount"]) != `"100"` || string(frames[0]["profitAmount"]) != `"-90"` || string(frames[0]["payoutUnit"]) != `"5"` {
		t.Fatal("wrong per-round charge, profit or payout allocation", frames[0])
	}
	for _, field := range []string{"requestId", "nextRequestId", "next"} {
		if _, ok := frames[0][field]; ok {
			t.Fatal("replay leaks mutable token", field)
		}
	}
	after, err := s.Status(context.Background(), session, "AG1")
	if err != nil || after.RequestID != first.NextRequestID || after.Balance != first.Balance {
		t.Fatal("query changed wallet or progress", after, err)
	}
	last := first
	for last.NextAction != "complete" {
		last, err = s.Spin(context.Background(), session, "AG1", last.NextRequestID, 100)
		if err != nil {
			t.Fatal(err)
		}
	}
	list = get(records, loginResponse.AccessToken, 200)
	_ = json.Unmarshal(list["items"], &items)
	if len(items) != 1 || items[0].BetAmount != "100" || items[0].TotalWinAmount != "90" || items[0].Status != "complete" {
		t.Fatal("free spins split or charged again", items)
	}
	var extended []struct {
		WinningRoundCount int    `json:"winningRoundCount"`
		TotalRoundCount   int    `json:"totalRoundCount"`
		ProfitAmount      string `json:"profitAmount"`
	}
	_ = json.Unmarshal(list["items"], &extended)
	if len(extended) != 1 || extended[0].WinningRoundCount != 6 || extended[0].TotalRoundCount != 9 || extended[0].ProfitAmount != "-10" {
		t.Fatal("missing win/round counts or net profit", extended)
	}
	replay = get(replayPath, loginResponse.AccessToken, 200)
	_ = json.Unmarshal(replay["frames"], &frames)
	var secondPayout []struct {
		Amount string `json:"amount"`
	}
	_ = json.Unmarshal(frames[1]["payouts"], &secondPayout)
	if len(secondPayout) != 1 || secondPayout[0].Amount != "20" || string(frames[1]["chargeAmount"]) != `"0"` {
		t.Fatal("continuation charged again or lost payout", frames[1])
	}
	if len(frames) != 9 {
		t.Fatal("incomplete free-chain replay", len(frames))
	}
	for i, f := range frames {
		if string(f["spinIndex"]) != []string{"0", "1", "2"}[i/3] || string(f["stepIndex"]) != []string{"1", "2", "3"}[i%3] {
			t.Fatal("replay out of order", i, f)
		}
	}
	// 分页跨越普通/免费、各次免费旋转边界时，也不能漏帧或重复。
	cursor := ""
	count := 0
	for page := 0; page < 5; page++ {
		result := get(replayPath+"?limit=2&cursor="+cursor, loginResponse.AccessToken, 200)
		var part []map[string]json.RawMessage
		if err = json.Unmarshal(result["frames"], &part); err != nil {
			t.Fatal(err)
		}
		for _, f := range part {
			if string(f["spinIndex"]) != []string{"0", "1", "2"}[count/3] || string(f["stepIndex"]) != []string{"1", "2", "3"}[count%3] {
				t.Fatal("free replay pagination lost ordering", count, f)
			}
			count++
		}
		cursor = ""
		if next, ok := result["nextCursor"]; ok {
			_ = json.Unmarshal(next, &cursor)
		}
		if page < 4 && cursor == "" {
			t.Fatal("free replay ended early")
		}
	}
	if count != 9 || cursor != "" {
		t.Fatal("free replay pagination missing or repeated frames", count, cursor)
	}
	get(replayPath, "", 401)
	get(records+"?limit=0", loginResponse.AccessToken, 400)
	get(records+"?limit=-1", loginResponse.AccessToken, 400)
	get(records+"?limit=1&limit=2", loginResponse.AccessToken, 400)
	get(replayPath+"?limit=201", loginResponse.AccessToken, 400)
	historical := get(records+"?from=2020-01-01T00:00:00Z&to=2020-01-02T00:00:00Z", loginResponse.AccessToken, 200)
	if string(historical["items"]) != "[]" {
		t.Fatal("date filter ignored", historical)
	}
	get(records+"?from=bad&to=bad", loginResponse.AccessToken, 400)
	get(records+"?from=2020-01-01T00:00:00Z&to=2020-01-09T00:00:00Z", loginResponse.AccessToken, 400)
	get(records+"?limit=bad", loginResponse.AccessToken, 400)
	get(records+"?limit=101", loginResponse.AccessToken, 400)
	get(records+"?cursor=bad", loginResponse.AccessToken, 400)
	get(replayPath+"?cursor=bad", loginResponse.AccessToken, 400)
	get(records+"/missing/replay", loginResponse.AccessToken, 404)
	get("/api/v1/games/OTHER/bet-records", loginResponse.AccessToken, 401)
}

func TestBetHistoryPaginationIsolationAndWalletUnchanged(t *testing.T) {
	store, _ := database(t)
	s := service(t, store, &spinner{})
	session, _ := login(t, s)
	ctx := context.Background()
	ids := map[string]bool{}
	for i := 0; i < 3; i++ {
		state, err := s.Status(ctx, session, "AG1")
		if err != nil {
			t.Fatal(err)
		}
		frame, err := s.Spin(ctx, session, "AG1", state.RequestID, 100)
		if err != nil {
			t.Fatal(err)
		}
		ids[frame.BetID] = true
		for frame.NextAction != "complete" {
			frame, err = s.Spin(ctx, session, "AG1", frame.NextRequestID, 100)
			if err != nil {
				t.Fatal(err)
			}
		}
	}
	before, err := s.Status(ctx, session, "AG1")
	if err != nil {
		t.Fatal(err)
	}
	cursor := ""
	seen := map[string]bool{}
	var newest string
	var firstCursor string
	for page := 0; page < 3; page++ {
		result, err := s.BetRecords(ctx, session, "AG1", 1, cursor)
		if err != nil {
			t.Fatal(err)
		}
		if len(result.Items) != 1 {
			t.Fatal("missing page", result)
		}
		record := result.Items[0]
		if !ids[record.BetID] || seen[record.BetID] {
			t.Fatal("duplicate or foreign record", record)
		}
		seen[record.BetID] = true
		if record.BetAmount != "100" || record.TotalWinAmount != "30" {
			t.Fatal("wrong whole-bet totals", record)
		}
		if page == 0 {
			newest = record.BetID
			firstCursor = result.NextCursor
		}
		if (page < 2) != (result.NextCursor != "") {
			t.Fatal("bad history pagination boundary", result)
		}
		cursor = result.NextCursor
	}
	cursor = ""
	steps := []int{}
	for page := 0; page < 3; page++ {
		result, err := s.BetReplay(ctx, session, "AG1", newest, 1, cursor)
		if err != nil {
			t.Fatal(err)
		}
		if len(result.Frames) != 1 {
			t.Fatal("bad replay page", result)
		}
		steps = append(steps, result.Frames[0].StepIndex)
		if result.Frames[0].RequestID != "" || result.Frames[0].NextRequestID != "" || result.Frames[0].Next != nil {
			t.Fatal("replay contains live settlement token")
		}
		if (page < 2) != (result.NextCursor != "") {
			t.Fatal("bad replay pagination boundary", result)
		}
		cursor = result.NextCursor
	}
	if !reflect.DeepEqual(steps, []int{1, 2, 3}) {
		t.Fatal("replay duplicate or omitted rounds", steps)
	}
	if _, err = s.BetReplay(ctx, session, "AG1", newest, 1, firstCursor); !errors.Is(err, play.ErrInvalid) {
		t.Fatal("wrong cursor kind accepted", err)
	}
	firstPage, err := s.BetReplay(ctx, session, "AG1", newest, 1, "")
	if err != nil {
		t.Fatal(err)
	}
	for id := range ids {
		if id != newest {
			if _, err = s.BetReplay(ctx, session, "AG1", id, 1, firstPage.NextCursor); !errors.Is(err, play.ErrInvalid) {
				t.Fatal("cross-bet cursor accepted", err)
			}
			break
		}
	}
	for _, change := range []func(*play.Session){
		func(s *play.Session) { s.Player.Subject.AppName = "other-platform" },
		func(s *play.Session) { s.Player.Subject.AppKey = "other-app" },
		func(s *play.Session) { s.Player.Subject.UID = "other-user" },
		func(s *play.Session) { s.Player.Country = "MX" },
		func(s *play.Session) { s.Player.Currency = "USD" },
	} {
		other := session
		change(&other)
		records, err := s.BetRecords(ctx, other, "AG1", 20, "")
		if err != nil || len(records.Items) != 0 {
			t.Fatal("foreign records disclosed", records, err)
		}
		if _, err = s.BetReplay(ctx, other, "AG1", newest, 100, ""); !errors.Is(err, play.ErrNotFound) {
			t.Fatal("foreign replay disclosed", err)
		}
	}
	after, err := s.Status(ctx, session, "AG1")
	if err != nil || !reflect.DeepEqual(before, after) {
		t.Fatal("history reads changed wallet, token or settlement", before, after, err)
	}
}
