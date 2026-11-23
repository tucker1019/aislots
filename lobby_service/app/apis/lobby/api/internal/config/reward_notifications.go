package config

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
)

type RewardNotificationRule struct {
	SendOnSettlement bool    `json:"sendOnSettlement"`
	ReminderHours    []int32 `json:"reminderHours"`
	SendOnExpired    bool    `json:"sendOnExpired"`
}

type RewardNotificationsConfig struct {
	Rebate      RewardNotificationRule `json:"rebate"`
	Leaderboard RewardNotificationRule `json:"leaderboard"`
	LossReturn  RewardNotificationRule `json:"lossReturn"`
}

func DefaultRewardNotifications() RewardNotificationsConfig {
	return RewardNotificationsConfig{
		Rebate:      RewardNotificationRule{SendOnSettlement: true, ReminderHours: []int32{12, 6}, SendOnExpired: true},
		Leaderboard: RewardNotificationRule{SendOnSettlement: true, ReminderHours: []int32{12, 6}, SendOnExpired: true},
		LossReturn:  RewardNotificationRule{SendOnSettlement: true, ReminderHours: []int32{12, 6}, SendOnExpired: true},
	}
}

func LoadRewardNotifications(path string) (RewardNotificationsConfig, error) {
	if path == "" {
		return DefaultRewardNotifications(), nil
	}
	file, err := os.Open(path)
	if err != nil {
		return RewardNotificationsConfig{}, err
	}
	defer func() { _ = file.Close() }()

	decoder := json.NewDecoder(file)
	decoder.DisallowUnknownFields()
	var value RewardNotificationsConfig
	if err = decoder.Decode(&value); err != nil {
		return value, err
	}
	if err = decoder.Decode(new(any)); err != io.EOF {
		return value, fmt.Errorf("trailing reward notification config")
	}
	for _, rule := range []RewardNotificationRule{value.Rebate, value.Leaderboard, value.LossReturn} {
		if err = rule.Validate(); err != nil {
			return value, err
		}
	}
	return value, nil
}

func (r RewardNotificationRule) Validate() error {
	seen := make(map[int32]bool, len(r.ReminderHours))
	for _, hours := range r.ReminderHours {
		if hours < 1 || hours >= 24 || seen[hours] {
			return fmt.Errorf("reward reminder hours must be unique values in [1,23]")
		}
		seen[hours] = true
	}
	return nil
}
