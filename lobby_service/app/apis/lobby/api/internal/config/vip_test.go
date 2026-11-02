package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestVIPPictureConfiguration(t *testing.T) {
	c, err := LoadVIP("../../../../../../etc/vip.json")
	if err != nil {
		t.Fatal(err)
	}
	if len(c.Levels) != 31 || c.Levels[1].UpgradeBet != 100 || c.Levels[2].UpgradeBet != 300000 || c.Levels[24].MonthlyReward != 277600 || c.Levels[30].UpgradeBet != 100000000000 || c.Levels[30].KeepBet != 3000000000 || c.Levels[30].MonthlyBet != 12000000 {
		t.Fatal(c)
	}
	for _, mutate := range []func(*VIPConfig){
		func(c *VIPConfig) { c.IdleDays = 0 }, func(c *VIPConfig) { c.ProtectionDays = 0 }, func(c *VIPConfig) { c.Version = "" },
		func(c *VIPConfig) { c.Levels[2].Level = 4 }, func(c *VIPConfig) { c.Levels[1].UpgradeBet = -1 }, func(c *VIPConfig) { c.Levels[0].WeeklyReward = 1 },
	} {
		copy := c
		copy.Levels = append([]VIPLevel(nil), c.Levels...)
		mutate(&copy)
		data, _ := json.Marshal(copy)
		p := filepath.Join(t.TempDir(), "vip.json")
		if e := os.WriteFile(p, data, 0o600); e != nil {
			t.Fatal(e)
		}
		if _, e := LoadVIP(p); e == nil {
			t.Fatal("accepted invalid config")
		}
	}
}
