package config

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"
)

type AgentTier struct {
	Threshold int64 `json:"threshold"`
	Rate      int64 `json:"rate"`
}
type AgentConfig struct {
	Version   string                 `json:"version"`
	Providers map[string][]AgentTier `json:"providers"`
}

func LoadAgent(path string) (AgentConfig, error) {
	if path == "" {
		path = "etc/agent.json"
	}
	var c AgentConfig
	b, e := os.ReadFile(path)
	if e != nil {
		return c, e
	}
	decoder := json.NewDecoder(bytes.NewReader(b))
	decoder.DisallowUnknownFields()
	if e = decoder.Decode(&c); e != nil {
		return c, e
	}
	if e = decoder.Decode(new(any)); e != io.EOF {
		return c, fmt.Errorf("trailing agent config")
	}
	if c.Version == "" || len(c.Providers) == 0 {
		return c, fmt.Errorf("agent version/providers required")
	}
	for name, tiers := range c.Providers {
		if name == "" || len(tiers) == 0 {
			return c, fmt.Errorf("agent provider tiers required")
		}
		var last, rate int64
		for _, t := range tiers {
			if t.Threshold <= last || t.Rate < rate || t.Rate <= 0 || t.Rate > 10000 {
				return c, fmt.Errorf("agent thresholds and rates must be ascending, rates 1..10000")
			}
			last = t.Threshold
			rate = t.Rate
		}
	}
	return c, nil
}
