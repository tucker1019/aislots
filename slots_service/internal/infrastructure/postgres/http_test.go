package postgres_test

import (
	"aislots/slots_service/internal/application/play"
	"aislots/slots_service/internal/transport/httpapi"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHTTPProgressiveProtocol(t *testing.T) {
	store, _ := database(t)
	service := service(t, store, &spinner{})
	server := httptest.NewServer(httpapi.NewGameRouter(func() bool { return true }, service, []string{"http://localhost:5180"}, slog.New(slog.NewTextHandler(io.Discard, nil))))
	defer server.Close()
	token := ""
	request := func(method, path string, body string, status int) map[string]json.RawMessage {
		t.Helper()
		r, err := http.NewRequestWithContext(context.Background(), method, server.URL+path, bytes.NewBufferString(body))
		if err != nil {
			t.Fatal(err)
		}
		if token != "" {
			r.Header.Set("Authorization", "Bearer "+token)
		}
		r.Header.Set("Origin", "http://localhost:5180")
		r.Header.Set("Content-Type", "application/json")
		response, err := http.DefaultClient.Do(r)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		data, err := io.ReadAll(response.Body)
		if err != nil {
			t.Fatal(err)
		}
		if response.StatusCode != status {
			t.Fatalf("%s %s: got %d want %d: %s", method, path, response.StatusCode, status, data)
		}
		var envelope struct {
			Code string
			Data map[string]json.RawMessage
		}
		if err = json.Unmarshal(data, &envelope); err != nil {
			t.Fatal(err)
		}
		return envelope.Data
	}
	request("GET", "/api/v1/games/AG1/bets", "", 401)
	login := request("POST", "/api/v1/login", `{"test":true,"appname":"test-platform","appkey":"test-app","uid":"test-user","gameId":"AG1"}`, 200)
	if err := json.Unmarshal(login["accessToken"], &token); err != nil {
		t.Fatal(err)
	}
	options := request("GET", "/api/v1/games/AG1/bets", "", 200)
	if string(options["betOptions"]) != `["100","101"]` {
		t.Fatal(options)
	}

	request("POST", "/api/v1/games/AG1/spin", `{"requestId":"x","betAmount":"100","uid":"forged"}`, 400)
	state := request("GET", "/api/v1/games/AG1/state", "", 200)
	var progress play.Status
	raw, _ := json.Marshal(state)
	if err := json.Unmarshal(raw, &progress); err != nil || progress.HasNext || progress.RequestID == "" {
		t.Fatal(progress, err)
	}
	body := `{"requestId":"` + progress.RequestID + `","betAmount":"100"}`
	first := request("POST", "/api/v1/games/AG1/spin", body, 200)
	if string(first["stepIndex"]) != "1" || string(first["winAmount"]) != `"10"` {
		t.Fatal(first)
	}
	if _, leaks := first["next"]; leaks {
		t.Fatal("internal cursor returned")
	}
	retry := request("POST", "/api/v1/games/AG1/spin", body, 200)
	if string(retry["requestId"]) != string(first["requestId"]) {
		t.Fatal("retry changed")
	}
	state = request("GET", "/api/v1/games/AG1/state", "", 200)
	if _, leaks := state["frame"]; leaks {
		t.Fatal("settled frame replayed on reconnect")
	}
	raw, _ = json.Marshal(state)
	_ = json.Unmarshal(raw, &progress)
	if !progress.HasNext {
		t.Fatal("missing continuation")
	}
	second := request("POST", "/api/v1/games/AG1/spin", `{"requestId":"`+progress.RequestID+`","betAmount":"100"}`, 200)
	if string(second["stepIndex"]) != "2" {
		t.Fatal("did not advance to next unsettled round")
	}
	var nextID string
	_ = json.Unmarshal(second["nextRequestId"], &nextID)
	final := request("POST", "/api/v1/games/AG1/spin", `{"requestId":"`+nextID+`","betAmount":"100"}`, 200)
	if string(final["nextAction"]) != `"complete"` {
		t.Fatal(final)
	}
	bad, err := http.NewRequest("GET", server.URL+"/healthz", nil)
	if err != nil {
		t.Fatal(err)
	}
	bad.Header.Set("Origin", "https://untrusted.example")
	response, err := http.DefaultClient.Do(bad)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != 403 {
		t.Fatal("untrusted origin accepted")
	}
}
