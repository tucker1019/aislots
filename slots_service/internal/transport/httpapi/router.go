// Package httpapi translates HTTP requests into application calls.
package httpapi

import (
	"aislots/slots_service/internal/trace"
	"encoding/json"
	"log/slog"
	"net/http"
)

// NewRouter currently exposes health checks only. The bet route will call application/bet.Service.
func NewRouter(ready func() bool) http.Handler {
	return trace.Middleware(newHealthMux(ready), slog.Default())
}
func newHealthMux(ready func() bool) *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { writeStatus(w, http.StatusOK, "ok") })
	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, r *http.Request) {
		if !ready() {
			writeStatus(w, http.StatusServiceUnavailable, "not_ready")
			return
		}
		writeStatus(w, http.StatusOK, "ready")
	})
	return mux
}
func writeStatus(w http.ResponseWriter, code int, status string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": status})
}
