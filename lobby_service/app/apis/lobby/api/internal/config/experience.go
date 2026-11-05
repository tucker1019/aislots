package config

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
)

type ExperienceConfig struct {
	CreateMinSeconds int  `json:"createMinSeconds"`
	CreateMaxSeconds int  `json:"createMaxSeconds"`
	PlayMinSeconds   int  `json:"playMinSeconds"`
	PlayMaxSeconds   int  `json:"playMaxSeconds"`
	Enabled          bool `json:"enabled"`
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

	return c, nil
}
