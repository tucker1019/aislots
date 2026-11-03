package main

import (
	"aislots/slots_service/internal/application/betlist"
	"aislots/slots_service/internal/application/play"
	"aislots/slots_service/internal/bootstrap"
	"aislots/slots_service/internal/infrastructure/gamedata"
	"aislots/slots_service/internal/infrastructure/lobby"
	"aislots/slots_service/internal/infrastructure/postgres"
	"aislots/slots_service/internal/transport/httpapi"
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)
	if err := run(logger); err != nil {
		logger.Error("server stopped", "error", err)
		os.Exit(1)
	}
}
func run(logger *slog.Logger) error {
	path := flag.String("config", "", "server JSON configuration path (required)")
	flag.Parse()
	if *path == "" {
		return fmt.Errorf("-config is required")
	}
	cfg, err := bootstrap.LoadConfig(*path)
	if err != nil {
		return err
	}
	catalog, err := bootstrap.LoadCatalog(cfg)
	if err != nil {
		return err
	}
	defer catalog.Close()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	var handler http.Handler = httpapi.NewRouter(func() bool { return catalog.Count() > 0 })
	if cfg.TestProfile.Enabled || cfg.Lobby.Enabled {
		url := os.Getenv(cfg.Database.URLEnv)
		if url == "" {
			return fmt.Errorf("database environment %s required", cfg.Database.URLEnv)
		}
		store, err := postgres.Open(ctx, url)
		if err != nil {
			return err
		}
		defer store.Close()
		if cfg.Database.AutoMigrate {
			if err = store.Migrate(ctx); err != nil {
				return err
			}
		}
		policies, err := gamedata.LoadBetPolicies(cfg.BetPoliciesFile)
		if err != nil {
			return err
		}
		bets, err := betlist.New(policies)
		if err != nil {
			return err
		}
		var service *play.Service
		if cfg.Lobby.Enabled {
			adapter, e := lobby.New(cfg.Lobby, os.Getenv(cfg.Lobby.TokenEnv))
			if e != nil {
				return e
			}
			store.UseLobby(adapter)
			service, err = play.NewLive(store, catalog, bets, adapter)
		} else {
			service, err = play.New(store, catalog, bets, cfg.TestProfile)
		}
		if err != nil {
			return err
		}
		handler = httpapi.NewGameRouter(func() bool {
			if catalog.Count() == 0 {
				return false
			}
			check, cancel := context.WithTimeout(context.Background(), time.Second)
			defer cancel()
			return store.Ping(check) == nil
		}, service, cfg.AllowedOrigins, logger)
	}
	server := &http.Server{Addr: cfg.HTTP.Address, Handler: handler, ReadHeaderTimeout: bootstrap.Seconds(cfg.HTTP.ReadHeaderTimeoutSeconds), ReadTimeout: bootstrap.Seconds(cfg.HTTP.ReadTimeoutSeconds), WriteTimeout: bootstrap.Seconds(cfg.HTTP.WriteTimeoutSeconds), IdleTimeout: bootstrap.Seconds(cfg.HTTP.IdleTimeoutSeconds)}
	done := make(chan error, 1)
	go func() { done <- server.ListenAndServe() }()
	logger.Info("server starting", "address", server.Addr, "games", catalog.Count(), "betEnabled", cfg.TestProfile.Enabled || cfg.Lobby.Enabled, "lobbyEnabled", cfg.Lobby.Enabled)
	select {
	case err := <-done:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
	}
	shutdown, cancel := context.WithTimeout(context.Background(), bootstrap.Seconds(cfg.HTTP.ShutdownTimeoutSeconds))
	defer cancel()
	if err := server.Shutdown(shutdown); err != nil {
		_ = server.Close()
		return err
	}
	return nil
}
