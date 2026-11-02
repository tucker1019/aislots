package xlog

import (
	"context"
	"log/slog"

	"apps/pkg/trace"
)

func Info(ctx context.Context, message string, args ...any) {
	trace.Logger(ctx, slog.Default()).InfoContext(ctx, message, args...)
}

func Error(ctx context.Context, message string, args ...any) {
	trace.Logger(ctx, slog.Default()).ErrorContext(ctx, message, args...)
}
