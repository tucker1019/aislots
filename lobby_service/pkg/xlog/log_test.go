package xlog

import (
	"bytes"
	"context"
	"log/slog"
	"strings"
	"testing"

	"apps/pkg/trace"
)

func TestContextLogs(t *testing.T) {
	var output bytes.Buffer
	old := slog.Default()
	defer slog.SetDefault(old)
	slog.SetDefault(slog.New(slog.NewJSONHandler(&output, nil)))
	Info(context.Background(), "startup", "service", "lobby")
	Error(trace.WithID(context.Background(), "trace-test-id"), "failure", "path", "/test")
	if !strings.Contains(output.String(), "trace-test-id") || !strings.Contains(output.String(), "startup") || !strings.Contains(output.String(), "failure") {
		t.Fatal(output.String())
	}
}
