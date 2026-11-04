package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/model"
	"apps/pkg/xlog"

	"github.com/jackc/pgx/v5"
	"gorm.io/gorm"
)

// One dedicated advisory-lock connection owns dispatch across lobby instances.
func StartExperience(ctx context.Context, c config.Config, db *gorm.DB) <-chan struct{} {
	done := make(chan struct{})
	go func() {
		defer close(done)
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for {
			if err := experienceTick(ctx, c, db); err != nil && ctx.Err() == nil {
				xlog.Error(ctx, "experience round paused; original request retained", "error", err)
			}
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
			}
		}
	}()
	return done
}

func experienceTick(ctx context.Context, c config.Config, db *gorm.DB) error {
	cfg, e := config.LoadExperience(os.Getenv("LOBBY_EXPERIENCE_CONFIG"))
	if e != nil {
		return e
	}
	step, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()
	conn, e := pgx.Connect(step, c.DatabaseURL)
	if e != nil {
		return e
	}
	defer func() { _ = conn.Close(context.Background()) }()
	var locked bool
	if e = conn.QueryRow(step, "SELECT pg_try_advisory_lock(2026110502)").Scan(&locked); e != nil {
		return e
	}
	if !locked {
		return nil
	}
	// A pending round drains even when enabled is switched off.
	m := model.ExperienceModel{DB: db}
	job, e := m.Prepare(step, cfg.Enabled, cfg.Bet, cfg.BetLevel, cfg.InitialCoins, time.Now().UTC())
	if e != nil || job == nil {
		return e
	}
	game := c.Game.Games["AG1"]
	if !game.Enabled || game.APIURL == "" || len(c.Game.ServiceToken) < 32 {
		return fmt.Errorf("experience AG1 service configuration unavailable")
	}
	body, e := json.Marshal(map[string]any{"requestId": job.RequestID, "uid": job.UID, "gameId": "AG1", "bet": job.Bet, "betLevel": job.BetLevel, "country": c.Game.Country, "currency": c.Game.Currency})
	if e != nil {
		return e
	}
	req, e := http.NewRequestWithContext(step, "POST", strings.TrimRight(game.APIURL, "/")+"/internal/auto-round", bytes.NewReader(body))
	if e != nil {
		return e
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.Game.ServiceToken)
	client := http.Client{Timeout: 55 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	res, e := client.Do(req)
	if e != nil {
		return fmt.Errorf("auto-round connection unavailable")
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("auto-round HTTP %d", res.StatusCode)
	}
	var reply struct {
		Code string
		Data struct{ Status, RequestID, BetID string }
	}
	if e = json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(&reply); e != nil {
		return e
	}
	if reply.Code != "OK" || reply.Data.Status != "complete" || reply.Data.RequestID != job.RequestID || reply.Data.BetID == "" {
		return fmt.Errorf("invalid auto-round receipt")
	}
	if e = conn.Ping(step); e != nil {
		return e
	}
	if e = m.Finish(step, job.RequestID, reply.Data.BetID, time.Duration(cfg.IntervalSeconds)*time.Second); e != nil {
		return e
	}
	xlog.Info(ctx, "experience round complete", "uid", job.UID, "betId", reply.Data.BetID)
	return nil
}
