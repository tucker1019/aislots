package server

import (
	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/model"
	"apps/pkg/xlog"
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	"gorm.io/gorm"
	"io"
	"math"
	"math/big"
	"net/http"
	"os"
	"strings"
	"time"
)

var errExperienceFunds = errors.New("experience balance exhausted")

func secureRange(min, max int) int {
	n, e := rand.Int(rand.Reader, big.NewInt(int64(max-min+1)))
	if e != nil {
		panic(e)
	}
	return min + int(n.Int64())
}
func nearestExperienceBet(amounts []int64, lines, maxLevel int, target int64) (int64, int) {
	var best, total int64
	level := 1
	distance := int64(math.MaxInt64)
	for _, a := range amounts {
		for l := 1; l <= maxLevel; l++ {
			if a <= 0 || lines < 1 || a > math.MaxInt64/int64(lines)/int64(l) {
				continue
			}
			v := a * int64(lines) * int64(l)
			d := v - target
			if d < 0 {
				d = -d
			}
			if d < distance || (d == distance && v < total) {
				best, level, total, distance = a, l, v, d
			}
		}
	}
	return best, level
}
func experiencePoolTick(ctx context.Context, c config.Config, db *gorm.DB) error {
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
	game := c.Game.Games["AG1"]
	if !game.Enabled || game.APIURL == "" || len(c.Game.ServiceToken) < 32 {
		return fmt.Errorf("experience service unavailable")
	}
	call := func(path string, input, output any) error {
		body, err := json.Marshal(input)
		if err != nil {
			return err
		}
		req, err := http.NewRequestWithContext(step, "POST", strings.TrimRight(game.APIURL, "/")+path, bytes.NewReader(body))
		if err != nil {
			return err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+c.Game.ServiceToken)
		client := http.Client{Timeout: 55 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
		res, err := client.Do(req)
		if err != nil {
			return fmt.Errorf("experience connection unavailable")
		}
		defer func() { _ = res.Body.Close() }()
		if res.StatusCode != 200 {
			var failure struct{ Code string }
			_ = json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(&failure)
			if failure.Code == "INSUFFICIENT_FUNDS" {
				return errExperienceFunds
			}
			return fmt.Errorf("experience HTTP %d", res.StatusCode)
		}
		return json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(output)
	}
	m := model.ExperienceModel{DB: db}
	var policy struct {
		Code string
		Data struct {
			Amounts             []int64
			LineCount, BetLevel int
		}
	}
	if cfg.Enabled {
		if e = call("/internal/auto-bets", map[string]any{"uid": 1, "gameId": "AG1", "country": c.Game.Country, "currency": c.Game.Currency}, &policy); e != nil {
			return e
		}
		if policy.Code != "OK" || len(policy.Data.Amounts) == 0 || policy.Data.LineCount < 1 || policy.Data.BetLevel < 1 {
			return fmt.Errorf("invalid experience policy")
		}
		initial := int64(secureRange(1, 100)) * 10000
		target := initial / int64(secureRange(100, 300))
		bet, level := nearestExperienceBet(policy.Data.Amounts, policy.Data.LineCount, policy.Data.BetLevel, target)
		if bet < 1 {
			return fmt.Errorf("no legal experience stake")
		}
		if e = m.CreateScheduled(step, time.Now().UTC(), initial, bet, level, c.Game.Country, c.Game.Currency, time.Duration(secureRange(cfg.CreateMinSeconds, cfg.CreateMaxSeconds))*time.Second); e != nil {
			return e
		}
	}
	jobs, e := m.DueJobs(step, cfg.Enabled, time.Now().UTC())
	if e != nil {
		return e
	}
	for _, job := range jobs {
		if job.Country == "" {
			job.Country = c.Game.Country
		}
		if job.Currency == "" {
			job.Currency = c.Game.Currency
		}
		if job.RequestID == "" {
			if e = m.BeginJob(step, &job, policy.Data.LineCount); e != nil {
				return e
			}
			if job.RequestID == "" {
				continue
			}
		}
		var reply struct {
			Code string
			Data struct{ Status, RequestID, BetID string }
		}
		e = call("/internal/auto-round", map[string]any{"requestId": job.RequestID, "uid": job.UID, "gameId": "AG1", "bet": job.Bet, "betLevel": job.BetLevel, "country": job.Country, "currency": job.Currency}, &reply)
		if errors.Is(e, errExperienceFunds) {
			if e = m.StopJob(step, job); e != nil {
				return e
			}
			continue
		}
		if e != nil {
			xlog.Error(ctx, "experience command retained", "uid", job.UID, "error", e)
			continue
		}
		if reply.Code != "OK" || reply.Data.Status != "complete" || reply.Data.RequestID != job.RequestID || reply.Data.BetID == "" {
			return fmt.Errorf("invalid experience receipt")
		}
		if e = conn.Ping(step); e != nil {
			return e
		}
		stop := (job.Rounds+1)%50 == 0 && secureRange(1, 100) <= 20
		if e = m.FinishJob(step, job, reply.Data.BetID, time.Duration(secureRange(cfg.PlayMinSeconds, cfg.PlayMaxSeconds))*time.Second, stop); e != nil {
			return e
		}
		xlog.Info(ctx, "experience round complete", "uid", job.UID, "betId", reply.Data.BetID, "stopped", stop)
	}
	return nil
}
