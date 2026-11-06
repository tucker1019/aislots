package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/server"
	migrations "apps/deploy/migration"
	"apps/pkg/xlog"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	if err := run(); err != nil {
		xlog.Error(context.Background(), "lobby stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	c, err := config.Load()
	if err != nil {
		return err
	}
	db, err := gorm.Open(postgres.Open(c.DatabaseURL), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		return err
	}
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	defer func() {
		if closeErr := sqlDB.Close(); closeErr != nil {
			xlog.Error(context.Background(), "database close failed", "error", closeErr)
		}
	}()
	if err = sqlDB.PingContext(ctx); err != nil {
		return err
	}
	if _, err = sqlDB.ExecContext(ctx, migrations.Schema); err != nil {
		return err
	}
	runtime, err := server.NewRuntime(ctx, db, c)
	if err != nil {
		return err
	}
	defer runtime.Close()
	server := &http.Server{Addr: c.Address, Handler: runtime, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second}

	done := make(chan error, 1)
	go func() { done <- server.ListenAndServe() }()
	xlog.Info(ctx, "lobby starting", "address", c.Address, "sessionDays", c.SessionDays)
	select {
	case err = <-done:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdown)
	}
}
