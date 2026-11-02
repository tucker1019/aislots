// Package trace correlates one HTTP request, its response header and its logs.
package trace

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"time"
)

const Header = "X-Trace-Id"

type contextKey struct{}

func WithID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, contextKey{}, id)
}
func ID(ctx context.Context) string { id, _ := ctx.Value(contextKey{}).(string); return id }
func Logger(ctx context.Context, logger *slog.Logger) *slog.Logger {
	if logger == nil {
		logger = slog.Default()
	}
	if id := ID(ctx); id != "" {
		return logger.With("traceId", id)
	}
	return logger
}

// Middleware generates a fresh server-owned ID; client values never override it.
func Middleware(next http.Handler, logger *slog.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var random [16]byte
		_, _ = rand.Read(random[:])
		id := hex.EncodeToString(random[:])
		ctx := WithID(r.Context(), id)
		w.Header().Set(Header, id)
		w.Header().Add("Access-Control-Expose-Headers", Header)
		recorder := &responseWriter{ResponseWriter: w, status: http.StatusOK}
		started := time.Now()
		defer func() {
			Logger(ctx, logger).InfoContext(ctx, "http request completed", "method", r.Method, "path", r.URL.Path, "status", recorder.status, "durationMs", time.Since(started).Milliseconds())
		}()
		next.ServeHTTP(recorder, r.WithContext(ctx))
	})
}

type responseWriter struct {
	http.ResponseWriter
	status  int
	written bool
}

func (w *responseWriter) WriteHeader(status int) {
	if status >= 100 && status < 200 {
		w.ResponseWriter.WriteHeader(status)
		return
	}
	if w.written {
		return
	}
	w.status = status
	w.written = true
	w.ResponseWriter.WriteHeader(status)
}
func (w *responseWriter) Write(data []byte) (int, error) {
	if !w.written {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(data)
}

// Unwrap preserves access to optional writer features through ResponseController.
func (w *responseWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }
