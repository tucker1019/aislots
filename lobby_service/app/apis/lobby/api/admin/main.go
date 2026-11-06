package main

import (
	"apps/app/apis/lobby/api/internal/adminapi"
	"apps/app/apis/lobby/api/internal/adminauth"
	"apps/app/apis/lobby/api/internal/adminconfig"
	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/model"
	migrations "apps/deploy/migration"
	"apps/pkg/xlog"
	"context"
	"errors"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

func main() {
	if e := run(); e != nil {
		xlog.Error(context.Background(), "admin stopped", "error", e)
		os.Exit(1)
	}
}
func run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	c, e := config.Load()
	if e != nil {
		return e
	}
	db, e := gorm.Open(postgres.Open(c.DatabaseURL), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if e != nil {
		return e
	}
	sqlDB, e := db.DB()
	if e != nil {
		return e
	}
	defer func() {
		if err := sqlDB.Close(); err != nil {
			xlog.Error(context.Background(), "admin database close failed", "error", err)
		}
	}()
	if _, e = sqlDB.ExecContext(ctx, migrations.Schema); e != nil {
		return e
	}
	if len(os.Args) > 1 && os.Args[1] == "bootstrap" {
		return adminauth.Bootstrap(db, os.Getenv("LOBBY_ADMIN_USERNAME"), os.Getenv("LOBBY_ADMIN_PASSWORD"))
	}
	if e = adminconfig.Seed(ctx, db, c); e != nil {
		return e
	}
	c, e = adminconfig.LoadPublished(ctx, db, c)
	if e != nil {
		return e
	}
	origins := os.Getenv("LOBBY_ADMIN_ORIGINS")
	if origins == "" {
		origins = "http://127.0.0.1:5176,http://localhost:5176"
	}
	auth := adminauth.New(db, strings.Split(origins, ","), os.Getenv("LOBBY_ADMIN_COOKIE_SECURE") == "true")
	mux := http.NewServeMux()
	auth.Register(mux)
	recharge := &model.RechargeModel{DB: db, ActivityLocation: c.Checkin.Location(), VIP: &model.VIPModel{DB: db, Config: c.VIP, Location: c.Checkin.Location()}}
	(&adminapi.API{DB: db, Location: c.Checkin.Location(), Recharge: recharge, ReviewModel: func(r *http.Request) (*model.RechargeModel, error) {
		snapshot, err := adminconfig.LoadPublished(r.Context(), db, c)
		if err != nil {
			return nil, err
		}
		return &model.RechargeModel{DB: db, ActivityLocation: snapshot.Checkin.Location(), VIP: &model.VIPModel{DB: db, Config: snapshot.VIP, Location: snapshot.Checkin.Location()}}, nil
	}}).Register(mux, auth)
	adminconfig.Register(mux, db, auth.Protect, auth.Actor)
	addr := os.Getenv("LOBBY_ADMIN_ADDRESS")
	if addr == "" {
		addr = "127.0.0.1:8082"
	}
	server := &http.Server{Addr: addr, Handler: mux, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 15 * time.Second, IdleTimeout: 60 * time.Second}
	done := make(chan error, 1)
	go func() { done <- server.ListenAndServe() }()
	select {
	case e = <-done:
		if errors.Is(e, http.ErrServerClosed) {
			return nil
		}
		return e
	case <-ctx.Done():
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return server.Shutdown(shutdown)
	}
}
