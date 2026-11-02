package trace

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
)

func TestMiddlewareHeadersAndRequestLogs(t *testing.T) {
	var logs bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logs, nil))
	mux := http.NewServeMux()
	mux.HandleFunc("GET /ok", func(w http.ResponseWriter, r *http.Request) {
		if ID(r.Context()) != w.Header().Get(Header) {
			t.Error("context/header mismatch")
		}
		_, _ = fmt.Fprint(w, "ok")
	})
	mux.HandleFunc("POST /bad", func(w http.ResponseWriter, r *http.Request) {
		Logger(r.Context(), logger).ErrorContext(r.Context(), "business error")
		http.Error(w, "bad", 400)
	})
	mux.HandleFunc("GET /error", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(500) })
	mux.HandleFunc("OPTIONS /preflight", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) })
	handler := Middleware(mux, logger)
	seen := map[string]bool{}
	for _, tc := range []struct {
		method, path string
		status       int
	}{{"GET", "/ok?sid=secret", 200}, {"POST", "/bad", 400}, {"GET", "/error", 500}, {"GET", "/missing", 404}, {"PUT", "/ok", 405}, {"OPTIONS", "/preflight", 204}} {
		request := httptest.NewRequest(tc.method, tc.path, nil)
		request.Header.Set(Header, "client-controlled")
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		id := response.Header().Get(Header)
		if !regexp.MustCompile(`^[a-f0-9]{32}$`).MatchString(id) || seen[id] {
			t.Fatal("invalid or duplicate trace ID", id)
		}
		seen[id] = true
		if response.Code != tc.status || !strings.Contains(response.Header().Get("Access-Control-Expose-Headers"), Header) {
			t.Fatal(response.Code, response.Header())
		}
	}
	if strings.Contains(logs.String(), "secret") || strings.Contains(logs.String(), "client-controlled") {
		t.Fatal("sensitive query or incoming ID logged", logs.String())
	}
	decoder := json.NewDecoder(&logs)
	completed := 0
	business := 0
	for decoder.More() {
		var record map[string]any
		if err := decoder.Decode(&record); err != nil {
			t.Fatal(err)
		}
		if !seen[record["traceId"].(string)] {
			t.Fatal("log trace not in responses", record)
		}
		if record["msg"] == "http request completed" {
			completed++
		}
		if record["msg"] == "business error" {
			business++
		}
	}
	if completed != 6 || business != 1 {
		t.Fatal(completed, business)
	}
}
func TestContextLoggerAndWriter(t *testing.T) {
	ctx := context.Background()
	if ID(ctx) != "" {
		t.Fatal("unexpected ID")
	}
	if Logger(ctx, nil) != slog.Default() {
		t.Fatal("default logger missing")
	}
	response := httptest.NewRecorder()
	w := &responseWriter{ResponseWriter: response, status: 200}
	if w.Unwrap() != response {
		t.Fatal("writer not unwrapped")
	}
	w.WriteHeader(201)
	w.WriteHeader(500)
	if w.status != 201 {
		t.Fatal("status overwritten")
	}
	// Informational headers do not commit the final status.
	info := &responseWriter{ResponseWriter: httptest.NewRecorder(), status: 200}
	info.WriteHeader(103)
	if info.written {
		t.Fatal("informational response committed")
	}
	info.WriteHeader(204)
	if info.status != 204 {
		t.Fatal("final status lost")
	}
}
