package config

import (
	"encoding/json"
	"fmt"
	"os"
)

type LeaderboardConfig struct {
	Rewards  []int64 `json:"rewards"`
	Turnover bool    `json:"turnover"`
}

func LoadLeaderboard(path string) (LeaderboardConfig, error) {
	if path == "" {
		path = "etc/leaderboard.json"
	}
	b, e := os.ReadFile(path)
	if e != nil {
		return LeaderboardConfig{}, e
	}
	var c LeaderboardConfig
	if e = json.Unmarshal(b, &c); e != nil || len(c.Rewards) != 10 {
		return c, fmt.Errorf("leaderboard rewards must contain exactly 10 amounts")
	}
	for _, v := range c.Rewards {
		if v < 0 {
			return c, fmt.Errorf("leaderboard reward cannot be negative")
		}
	}
	return c, nil
}
