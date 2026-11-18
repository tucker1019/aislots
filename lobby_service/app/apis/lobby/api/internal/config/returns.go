package config

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
)

// 10000 basis points = 100%. Pointers in the decoder distinguish omitted from zero rates.
type ReturnConfig struct {
	DailyRateBps       int32           `json:"dailyRateBps"`
	WeeklyRateBps      int32           `json:"weeklyRateBps"`
	MonthlyRateBps     int32           `json:"monthlyRateBps"`
	LoserReturnRateBps int32           `json:"loserReturnRateBps"`
	PlatformFeeRateBps int32           `json:"platformFeeRateBps"`
	RewardSources      map[string]bool `json:"rewardSources"`
}

func LoadReturns(path string) (ReturnConfig, error) {
	var c ReturnConfig
	if path == "" {
		path = "etc/returns.json"
	}
	f, err := os.Open(path)
	if err != nil {
		return c, err
	}
	defer func() { _ = f.Close() }()
	var raw struct {
		Daily   *int32          `json:"dailyRateBps"`
		Weekly  *int32          `json:"weeklyRateBps"`
		Monthly *int32          `json:"monthlyRateBps"`
		Loser   *int32          `json:"loserReturnRateBps"`
		Fee     int32           `json:"platformFeeRateBps"`
		Sources map[string]bool `json:"rewardSources"`
	}
	d := json.NewDecoder(f)
	d.DisallowUnknownFields()
	if err = d.Decode(&raw); err != nil {
		return c, err
	}
	if err = d.Decode(new(any)); err != io.EOF {
		return c, fmt.Errorf("trailing return config")
	}
	for _, rate := range []*int32{raw.Daily, raw.Weekly, raw.Monthly, raw.Loser} {
		if rate == nil || *rate < 0 || *rate > 10000 {
			return c, fmt.Errorf("return rates must be specified in [0,10000]")
		}
	}
	c = ReturnConfig{DailyRateBps: *raw.Daily, WeeklyRateBps: *raw.Weekly, MonthlyRateBps: *raw.Monthly, LoserReturnRateBps: *raw.Loser}
	c.PlatformFeeRateBps = raw.Fee
	c.RewardSources = raw.Sources
	if err = c.LossConfig().Validate(); err != nil {
		return c, err
	}
	return c, nil
}
