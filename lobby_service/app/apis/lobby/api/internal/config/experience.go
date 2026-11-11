package config

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
)

type ExperienceConfig struct {
	GameWeights       map[string]int64 `json:"gameWeights,omitempty"`
	StopEveryRounds   *int             `json:"stopEveryRounds,omitempty"`
	StopChancePercent *int             `json:"stopChancePercent,omitempty"`
	CreateMinSeconds  int              `json:"createMinSeconds"`
	CreateMaxSeconds  int              `json:"createMaxSeconds"`
	PlayMinSeconds    int              `json:"playMinSeconds"`
	PlayMaxSeconds    int              `json:"playMaxSeconds"`
	Enabled           bool             `json:"enabled"`
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
	if c.CreateMinSeconds < 1 || c.CreateMaxSeconds < c.CreateMinSeconds || c.PlayMinSeconds < 1 || c.PlayMaxSeconds < c.PlayMinSeconds || c.CreateMaxSeconds > 86400 || c.PlayMaxSeconds > 86400 {
		return c, fmt.Errorf("invalid experience timing")
	}

	if c.StopEveryRounds != nil && (*c.StopEveryRounds < 1 || *c.StopEveryRounds > 1000000) {
		return c, fmt.Errorf("stopEveryRounds must be between 1 and 1000000")
	}
	if c.StopChancePercent != nil && (*c.StopChancePercent < 0 || *c.StopChancePercent > 100) {
		return c, fmt.Errorf("stopChancePercent must be between 0 and 100")
	}
	if len(c.GameWeights) > 1000 {
		return c, fmt.Errorf("too many experience game weights")
	}
	for id, weight := range c.GameWeights {
		if !gameIDPattern.MatchString(id) || weight < 0 || weight > 1000000000 {
			return c, fmt.Errorf("invalid experience game weight %s", id)
		}
	}
	return c, nil
}

func (c ExperienceConfig) Weights() map[string]int64 {
	if c.GameWeights == nil {
		return map[string]int64{"AG1": 1}
	}
	return c.GameWeights
}
func (c ExperienceConfig) StopPolicy() (int, int) {
	every, chance := 50, 20
	if c.StopEveryRounds != nil {
		every = *c.StopEveryRounds
	}
	if c.StopChancePercent != nil {
		chance = *c.StopChancePercent
	}
	return every, chance
}
