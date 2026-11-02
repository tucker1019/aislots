package config

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"os"
	"time"
)

type NewbieTier struct {
	ID               string `json:"id"`
	RequiredRecharge int64  `json:"requiredRecharge"`
	Reward           int64  `json:"reward"`
}
type NewbieConfig struct {
	Version         string       `json:"version"`
	DurationDays    int32        `json:"durationDays"`
	ExpireUnclaimed bool         `json:"expireUnclaimed"`
	Tiers           []NewbieTier `json:"tiers"`
}

func (c NewbieConfig) Duration() time.Duration { return time.Duration(c.DurationDays) * 24 * time.Hour }
func LoadNewbie(path string) (NewbieConfig, error) {
	var c NewbieConfig
	if path == "" {
		path = "etc/newbie-recharge.json"
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
		return c, fmt.Errorf("trailing newbie config")
	}
	if c.Version == "" || len(c.Version) > 64 || c.DurationDays < 1 || c.DurationDays > 3650 || len(c.Tiers) < 1 || len(c.Tiers) > 1000 {
		return c, fmt.Errorf("invalid newbie recharge config")
	}
	seen := map[string]bool{}
	var last, total int64
	for _, t := range c.Tiers {
		if t.ID == "" || len(t.ID) > 64 || seen[t.ID] || t.RequiredRecharge <= last || t.Reward <= 0 || total > math.MaxInt64-t.Reward {
			return c, fmt.Errorf("invalid newbie tier %s", t.ID)
		}
		seen[t.ID] = true
		last = t.RequiredRecharge
		total += t.Reward
	}
	return c, nil
}
