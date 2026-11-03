package config

import (
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"os"
)

type InviteConfig struct {
	Version          string `json:"version"`
	DurationDays     int32  `json:"durationDays"`
	MinDepositCount  int32  `json:"minDepositCount"`
	MinDepositAmount int64  `json:"minDepositAmount"`
	MinBetAmount     int64  `json:"minBetAmount"`
	RewardAmount     int64  `json:"rewardAmount"`
	DisplayRows      int32  `json:"displayRows"`
	BaseURL          string `json:"baseUrl"`
	SupportURL       string `json:"supportUrl"`
}

func LoadInvite(path string) (InviteConfig, error) {
	if path == "" {
		path = "etc/invite.json"
	}
	var c InviteConfig
	f, e := os.Open(path)
	if e != nil {
		return c, e
	}
	defer func() { _ = f.Close() }()
	d := json.NewDecoder(f)
	d.DisallowUnknownFields()
	if e = d.Decode(&c); e != nil {
		return c, e
	}
	if e = d.Decode(new(any)); e != io.EOF {
		return c, fmt.Errorf("trailing invite config")
	}
	if c.Version == "" || c.DurationDays < 1 || c.DurationDays > 365 || c.MinDepositCount < 1 || c.MinDepositCount > 10000 || c.MinDepositAmount < 1 || c.MinDepositAmount > 1e14 || c.MinBetAmount < 1 || c.MinBetAmount > 1e14 || c.RewardAmount < 1 || c.RewardAmount > 1e12 || c.DisplayRows < 1 || c.DisplayRows > 50 {
		return c, fmt.Errorf("invalid invite config")
	}
	for _, raw := range []string{c.BaseURL, c.SupportURL} {
		u, e := url.Parse(raw)
		if e != nil || u.Host == "" || u.User != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Fragment != "" || u.RawQuery != "" {
			return c, fmt.Errorf("invalid invite URL")
		}
	}
	return c, nil
}
