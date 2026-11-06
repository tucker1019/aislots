package model

import (
	"apps/app/apis/lobby/api/internal/config"
	"errors"
	"gorm.io/gorm"
	"time"
)

// ConfigureReturnRates initializes immutable historical baselines, or schedules a
// publication for the next period boundary. Pass the configuration publication's
// transaction so rules, document and audit become visible together.
func ConfigureReturnRates(tx *gorm.DB, c config.ReturnConfig, loc *time.Location, now time.Time, initial bool) error {
	if loc == nil {
		return errors.New("return activity timezone is required")
	}
	return tx.Transaction(func(db *gorm.DB) error {
		for _, kind := range []string{ReturnDaily, ReturnWeekly, ReturnMonthly, ReturnLoser} {
			rate := rateFor(c, kind)
			if rate < 0 || rate > 10000 {
				return errors.New("return rate outside [0,10000]")
			}
			if initial {
				if e := db.Exec(`INSERT INTO lobby_return_rate_rules(kind,effective_from,rate_bps) VALUES(?,'0001-01-01',?) ON CONFLICT(kind,effective_from) DO NOTHING`, kind, rate).Error; e != nil {
					return e
				}
				continue
			}
			var count int64
			if e := db.Table("lobby_return_rate_rules").Where("kind=? AND effective_from='0001-01-01'", kind).Count(&count).Error; e != nil {
				return e
			}
			if count != 1 {
				return errors.New("return rate baseline must be initialized before publishing")
			}
			_, _, next := returnBounds(now, loc, kind)
			if e := db.Exec(`INSERT INTO lobby_return_rate_rules(kind,effective_from,rate_bps) VALUES(?,?,?) ON CONFLICT(kind,effective_from) DO UPDATE SET rate_bps=EXCLUDED.rate_bps,updated_at=now()`, kind, next.Format(time.DateOnly), rate).Error; e != nil {
				return e
			}
		}
		return nil
	})
}

func effectiveReturnRate(tx *gorm.DB, c config.ReturnConfig, kind string, start time.Time) (int32, error) {
	var rows []struct{ RateBps int32 }
	e := tx.Table("lobby_return_rate_rules").Select("rate_bps").Where("kind=? AND effective_from<=?", kind, start.Format(time.DateOnly)).Order("effective_from DESC").Limit(1).Scan(&rows).Error
	if e != nil {
		return 0, e
	}
	if len(rows) == 0 {
		return rateFor(c, kind), nil
	}
	return rows[0].RateBps, nil
}
