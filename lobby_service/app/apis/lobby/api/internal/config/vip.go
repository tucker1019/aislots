package config

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"os"
	"time"
)

type VIPLevel struct {
	Level           int32 `json:"level"`
	UpgradeBet      int64 `json:"upgradeBet"`
	UpgradeRecharge int64 `json:"upgradeRecharge"`
	KeepBet         int64 `json:"keepBet"`
	KeepRecharge    int64 `json:"keepRecharge"`
	UpgradeReward   int64 `json:"upgradeReward"`
	WeeklyReward    int64 `json:"weeklyReward"`
	MonthlyReward   int64 `json:"monthlyReward"`
	BirthdayReward  int64 `json:"birthdayReward"`
	WeeklyBet       int64 `json:"weeklyBet"`
	WeeklyRecharge  int64 `json:"weeklyRecharge"`
	MonthlyBet      int64 `json:"monthlyBet"`
	MonthlyRecharge int64 `json:"monthlyRecharge"`
}

type VIPConfig struct {
	Version        string     `json:"version"`
	IdleDays       int32      `json:"idleDays"`
	ProtectionDays int32      `json:"protectionDays"`
	Levels         []VIPLevel `json:"levels"`
}

func (c VIPConfig) IdleDuration() time.Duration { return time.Duration(c.IdleDays) * 24 * time.Hour }
func (c VIPConfig) ProtectionDuration() time.Duration {
	return time.Duration(c.ProtectionDays) * 24 * time.Hour
}

func LoadVIP(path string) (VIPConfig, error) {
	var c VIPConfig
	if path == "" {
		path = "etc/vip.json"
	}
	f, err := os.Open(path)
	if err != nil {
		return c, err
	}
	defer func() { _ = f.Close() }()
	d := json.NewDecoder(f)
	d.DisallowUnknownFields()
	if err = d.Decode(&c); err != nil {
		return c, err
	}
	if err = d.Decode(new(any)); err != io.EOF {
		return c, fmt.Errorf("trailing VIP config")
	}
	if c.Version == "" || len(c.Version) > 64 || c.IdleDays < 1 || c.IdleDays > 3650 || c.ProtectionDays < 1 || c.ProtectionDays > 3650 || len(c.Levels) < 2 || len(c.Levels) > 1001 {
		return c, fmt.Errorf("invalid VIP config")
	}
	var total int64
	for i, l := range c.Levels {
		if l.Level != int32(i) {
			return c, fmt.Errorf("VIP levels must be contiguous from 0")
		}
		for _, v := range []int64{l.UpgradeBet, l.UpgradeRecharge, l.KeepBet, l.KeepRecharge, l.UpgradeReward, l.WeeklyReward, l.MonthlyReward, l.BirthdayReward, l.WeeklyBet, l.WeeklyRecharge, l.MonthlyBet, l.MonthlyRecharge} {
			if v < 0 {
				return c, fmt.Errorf("negative VIP amount at level %d", i)
			}
		}
		if total > math.MaxInt64-l.UpgradeReward {
			return c, fmt.Errorf("VIP rewards overflow")
		}
		total += l.UpgradeReward
		if i == 0 && l != (VIPLevel{}) {
			return c, fmt.Errorf("VIP0 must contain zero amounts")
		}
	}
	return c, nil
}
