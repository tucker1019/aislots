package server

import (
	"apps/app/apis/lobby/api/internal/adminconfig"
	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/model"
	"apps/pkg/xlog"
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	"gorm.io/gorm"
	"math"
	"math/big"
	"os"
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
	cfg, e = adminconfig.LoadExperiencePublished(ctx, db, cfg)
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
	return dispatchExperience(step, c, cfg, db, conn.Ping)
}

func dispatchExperience(ctx context.Context, c config.Config, cfg config.ExperienceConfig, db *gorm.DB, lease func(context.Context) error) error {
	if lease != nil {
		if err := lease(ctx); err != nil {
			return err
		}
	}
	m := model.ExperienceModel{DB: db}
	client := experienceClient{config: c, policies: map[string]experiencePolicy{}}
	if cfg.Enabled {
		due, err := m.CreationDue(ctx, time.Now().UTC())
		if err != nil {
			return err
		}
		if due {
			if err = createExperienceAccount(ctx, c, cfg, m, &client); err != nil {
				xlog.Error(ctx, "experience creation paused", "error", err)
			}
		}
	}
	jobs, err := m.DueJobs(ctx, cfg.Enabled, time.Now().UTC())
	if err != nil {
		return err
	}
	every, chance := cfg.StopPolicy()
	for _, job := range jobs {
		if err := ctx.Err(); err != nil {
			return err
		}
		if lease != nil {
			if err := lease(ctx); err != nil {
				return err
			}
		}
		game, ok := c.Game.Games[job.GameID]
		// Weight changes never move existing accounts. Offline games pause new rounds;
		// persisted requests still recover against the original game and request ID.
		if !ok || game.APIURL == "" || (job.RequestID == "" && !game.Enabled) {
			continue
		}
		if job.Country == "" {
			job.Country = c.Game.Country
		}
		if job.Currency == "" {
			job.Currency = c.Game.Currency
		}
		if job.RequestID == "" {
			policy, err := client.policy(ctx, job.GameID, job.Country, job.Currency)
			if err != nil {
				xlog.Error(ctx, "experience policy paused", "gameId", job.GameID, "error", err)
				continue
			}
			if err = m.BeginJob(ctx, &job, policy.LineCount); err != nil {
				xlog.Error(ctx, "experience command paused", "uid", job.UID, "error", err)
				continue
			}
			if job.RequestID == "" {
				continue
			}
		}
		var reply struct {
			Code string
			Data struct{ Status, RequestID, BetID string }
		}
		err := client.call(ctx, job.GameID, "/internal/auto-round", map[string]any{"requestId": job.RequestID, "uid": job.UID, "gameId": job.GameID, "bet": job.Bet, "betLevel": job.BetLevel, "country": job.Country, "currency": job.Currency}, &reply)
		if errors.Is(err, errExperienceFunds) {
			if err = m.StopJob(ctx, job); err != nil {
				return err
			}
			continue
		}
		if err != nil {
			xlog.Error(ctx, "experience command retained", "uid", job.UID, "gameId", job.GameID, "error", err)
			continue
		}
		if reply.Code != "OK" || reply.Data.Status != "complete" || reply.Data.RequestID != job.RequestID || reply.Data.BetID == "" {
			xlog.Error(ctx, "invalid experience receipt; command retained", "uid", job.UID)
			continue
		}
		if lease != nil {
			if err := lease(ctx); err != nil {
				return err
			}
		}
		stop := experienceShouldStop(job.Rounds+1, every, chance, func() int { return secureRange(1, 100) })
		if err = m.FinishJob(ctx, job, reply.Data.BetID, time.Duration(secureRange(cfg.PlayMinSeconds, cfg.PlayMaxSeconds))*time.Second, stop); err != nil {
			return err
		}
		xlog.Info(ctx, "experience round complete", "uid", job.UID, "gameId", job.GameID, "betId", reply.Data.BetID, "stopped", stop)
	}
	return nil
}
func createExperienceAccount(ctx context.Context, c config.Config, cfg config.ExperienceConfig, m model.ExperienceModel, client *experienceClient) error {
	gameID, err := selectExperienceGame(cfg, c.Game.Games, experienceDraw)
	if err != nil || gameID == "" {
		return err
	}
	policy, err := client.policy(ctx, gameID, c.Game.Country, c.Game.Currency)
	if err != nil {
		return err
	}
	initial := int64(secureRange(1, 100)) * 10000
	target := initial / int64(secureRange(100, 300))
	bet, level := nearestExperienceBet(policy.Amounts, policy.LineCount, policy.BetLevel, target)
	if bet < 1 {
		return fmt.Errorf("no legal experience stake for %s", gameID)
	}
	return m.CreateScheduled(ctx, time.Now().UTC(), initial, bet, level, gameID, c.Game.Country, c.Game.Currency, time.Duration(secureRange(cfg.CreateMinSeconds, cfg.CreateMaxSeconds))*time.Second)
}
