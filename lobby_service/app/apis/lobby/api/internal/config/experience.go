package config

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
)

type ExperienceConfig struct {
	Enabled         bool  `json:"enabled"`
	Bet             int64 `json:"bet"`
	BetLevel        int   `json:"betLevel"`
	IntervalSeconds int   `json:"intervalSeconds"`
	InitialCoins    int64 `json:"initialCoins"`
}

func LoadExperience(path string) (ExperienceConfig, error) {
	if path == "" {
		path = "etc/experience.json"
	}
	f, e := os.Open(path)
	if e != nil {
		return ExperienceConfig{}, e
	}
	defer func() { _ = f.Close() }()
	var c ExperienceConfig
	d := json.NewDecoder(f)
	d.DisallowUnknownFields()
	if e = d.Decode(&c); e != nil {
		return c, e
	}
	var extra any
	if e = d.Decode(&extra); e != io.EOF {
		return c, fmt.Errorf("trailing experience configuration")
	}
	if c.Bet < 1 || c.Bet > 1000000 || c.BetLevel < 1 || c.BetLevel > 100 || c.IntervalSeconds < 5 || c.IntervalSeconds > 86400 || c.InitialCoins < 1 || c.InitialCoins > 1000000000 {
		return c, fmt.Errorf("invalid experience configuration")
	}
	return c, nil
}
