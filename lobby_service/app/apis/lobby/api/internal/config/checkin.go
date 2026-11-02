package config

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"time"
	_ "time/tzdata"
)

type CheckinDay struct {
	RequiredBet      int64 `json:"requiredBet"`
	RequiredRecharge int64 `json:"requiredRecharge"`
	Reward           int64 `json:"reward"`
}

type CheckinConfig struct {
	Version  string       `json:"version"`
	Timezone string       `json:"timezone"`
	Days     []CheckinDay `json:"days"`
}

func LoadCheckin(path string) (CheckinConfig, error) {
	var c CheckinConfig
	if path == "" {
		path = "etc/checkin.json"
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
		return c, fmt.Errorf("trailing checkin config")
	}
	if c.Version == "" || len(c.Version) > 64 || c.Timezone == "" || len(c.Days) < 1 || len(c.Days) > 366 {
		return c, fmt.Errorf("invalid checkin config")
	}
	if _, err = time.LoadLocation(c.Timezone); err != nil {
		return c, err
	}
	for _, day := range c.Days {
		if day.RequiredBet < 0 || day.RequiredRecharge < 0 || day.Reward <= 0 {
			return c, fmt.Errorf("invalid checkin day")
		}
	}
	return c, nil
}

func (c CheckinConfig) Location() *time.Location {
	loc, err := time.LoadLocation(c.Timezone)
	if err != nil {
		return time.UTC
	}
	return loc
}
