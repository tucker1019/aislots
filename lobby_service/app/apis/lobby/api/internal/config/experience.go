package config

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
)

type ExperienceConfig struct {
	InitialCoinsMin   *int64           `json:"initialCoinsMin,omitempty"`
	InitialCoinsMax   *int64           `json:"initialCoinsMax,omitempty"`
	InitialCoinsStep  *int64           `json:"initialCoinsStep,omitempty"`
	BetDivisorMin     *int             `json:"betDivisorMin,omitempty"`
	BetDivisorMax     *int             `json:"betDivisorMax,omitempty"`
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
	min, max, step, divisorMin, divisorMax := c.FundingPolicy()
	const maxSafeAmount int64 = 9007199254740991
	if min < 1 || max < min || max > maxSafeAmount || step < 1 || step > maxSafeAmount || (max-min)%step != 0 {
		return c, fmt.Errorf("initial coins require 0 < min <= max <= %d and a positive step dividing max-min", maxSafeAmount)
	}
	if divisorMin < 1 || divisorMax < divisorMin || divisorMax > 1000000 {
		return c, fmt.Errorf("bet divisors require 1 <= min <= max <= 1000000")
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

// FundingPolicy preserves the previous behavior for already-published documents
// that do not yet include the optional funding fields. All amounts are minor units.
func (c ExperienceConfig) FundingPolicy() (min, max, step int64, divisorMin, divisorMax int) {
	min, max, step, divisorMin, divisorMax = 10000, 1000000, 10000, 100, 300
	if c.InitialCoinsMin != nil {
		min = *c.InitialCoinsMin
	}
	if c.InitialCoinsMax != nil {
		max = *c.InitialCoinsMax
	}
	if c.InitialCoinsStep != nil {
		step = *c.InitialCoinsStep
	}
	if c.BetDivisorMin != nil {
		divisorMin = *c.BetDivisorMin
	}
	if c.BetDivisorMax != nil {
		divisorMax = *c.BetDivisorMax
	}
	return
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
