package config

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
)

// Reward category IDs are stable; amounts come only from committed wallet credits.
var LossRewardCategories = []string{"rebate", "checkin", "vipUpgrade", "vipWeekly", "vipMonthly", "lossReturn", "rechargeBonus", "withdrawalBonus", "newbieReward", "agentCommission", "inviteReward"}

type LossReturnConfig struct {
	LoserReturnRateBps int32           `json:"loserReturnRateBps"`
	PlatformFeeRateBps int32           `json:"platformFeeRateBps"`
	RewardSources      map[string]bool `json:"rewardSources"`
}

func (c ReturnConfig) LossConfig() LossReturnConfig {
	return LossReturnConfig{c.LoserReturnRateBps, c.PlatformFeeRateBps, c.RewardSources}
}

func (c *ReturnConfig) SetLoss(v LossReturnConfig) {
	c.LoserReturnRateBps = v.LoserReturnRateBps
	c.PlatformFeeRateBps = v.PlatformFeeRateBps
	c.RewardSources = v.RewardSources
}

func (c LossReturnConfig) Validate() error {
	if c.LoserReturnRateBps < 0 || c.LoserReturnRateBps > 10000 || c.PlatformFeeRateBps < 0 || c.PlatformFeeRateBps > 10000 {
		return fmt.Errorf("return and platform fee rates must be in [0,10000]")
	}
	for key := range c.RewardSources {
		known := false
		for _, category := range LossRewardCategories {
			if key == category {
				known = true
				break
			}
		}
		if !known {
			return fmt.Errorf("unknown loss reward category: %s", key)
		}
	}
	return nil
}

func LoadLossReturn(path string) (LossReturnConfig, error) {
	var c LossReturnConfig
	f, err := os.Open(path)
	if err != nil {
		return c, err
	}
	defer func() { _ = f.Close() }()
	var raw struct {
		Rate    *int32          `json:"loserReturnRateBps"`
		Fee     *int32          `json:"platformFeeRateBps"`
		Sources map[string]bool `json:"rewardSources"`
	}
	d := json.NewDecoder(f)
	d.DisallowUnknownFields()
	if err = d.Decode(&raw); err != nil {
		return c, err
	}
	if err = d.Decode(new(any)); err != io.EOF {
		return c, fmt.Errorf("trailing loss return config")
	}
	if raw.Rate == nil || raw.Fee == nil || raw.Sources == nil {
		return c, fmt.Errorf("loss return rate, platform fee and reward sources are required")
	}
	c = LossReturnConfig{*raw.Rate, *raw.Fee, raw.Sources}
	return c, c.Validate()
}
