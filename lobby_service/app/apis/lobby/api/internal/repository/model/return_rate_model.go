package model

import (
	"encoding/json"
	"errors"
	"time"

	"apps/app/apis/lobby/api/internal/config"

	"gorm.io/gorm"
)

// ConfigureReturnRates records baseline/publication policies for audit compatibility.
// Unclaimed rewards use the current published configuration immediately.
// Pass the publication transaction so policy records and audit commit together.
func ConfigureReturnRates(tx *gorm.DB, c config.ReturnConfig, loc *time.Location, now time.Time, initial bool) error {
	return configureReturnKinds(tx, c, loc, now, initial, []string{ReturnDaily, ReturnWeekly, ReturnMonthly, ReturnLoser})
}

func configureReturnKinds(tx *gorm.DB, c config.ReturnConfig, loc *time.Location, now time.Time, initial bool, kinds []string) error {
	if e := c.LossConfig().Validate(); e != nil {
		return e
	}
	if loc == nil {
		return errors.New("return activity timezone is required")
	}
	return tx.Transaction(func(db *gorm.DB) error {
		for _, kind := range kinds {
			fee := int32(0)
			sources := map[string]bool{}
			if kind == ReturnLoser {
				fee = c.PlatformFeeRateBps
				sources = c.RewardSources
				if sources == nil {
					sources = map[string]bool{}
				}
			}
			encoded, e := json.Marshal(sources)
			if e != nil {
				return e
			}
			rate := rateFor(c, kind)
			if rate < 0 || rate > 10000 {
				return errors.New("return rate outside [0,10000]")
			}
			if initial {
				if e := db.Exec(`INSERT INTO lobby_return_rate_rules(kind,effective_from,rate_bps,platform_fee_rate_bps,reward_sources) VALUES(?,'0001-01-01',?,?,?::jsonb) ON CONFLICT(kind,effective_from) DO NOTHING`, kind, rate, fee, string(encoded)).Error; e != nil {
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
			effectiveDate := activityDate(now, loc)
			if e := db.Exec(`INSERT INTO lobby_return_rate_rules(kind,effective_from,rate_bps,platform_fee_rate_bps,reward_sources) VALUES(?,?,?,?,?::jsonb) ON CONFLICT(kind,effective_from) DO UPDATE SET rate_bps=EXCLUDED.rate_bps,platform_fee_rate_bps=EXCLUDED.platform_fee_rate_bps,reward_sources=EXCLUDED.reward_sources,updated_at=now()`, kind, effectiveDate, rate, fee, string(encoded)).Error; e != nil {
				return e
			}
		}
		return nil
	})
}

// Saved claims keep their paid snapshot; every unclaimed period uses this request's published config.
func effectiveReturnRate(_ *gorm.DB, c config.ReturnConfig, kind string, _ time.Time) (int32, error) {
	rate := rateFor(c, kind)
	if rate < 0 || rate > 10000 {
		return 0, errors.New("return rate outside [0,10000]")
	}
	return rate, nil
}
