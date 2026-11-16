package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestExperienceConfig(t *testing.T) {
	c, e := LoadExperience("../../../../../../etc/experience.json")
	if e != nil || c.CreateMinSeconds != 300 || !c.Enabled {
		t.Fatal(c, e)
	}
	p := filepath.Join(t.TempDir(), "experience.json")
	for _, v := range []string{`{}`, `{"enabled":true,"bet":10,"betLevel":1,"intervalSeconds":1,"initialCoins":100}`, `{"extra":1}`, `{} {}`, `invalid`} {
		if e = os.WriteFile(p, []byte(v), 0o600); e != nil {
			t.Fatal(e)
		}
		if _, e = LoadExperience(p); e == nil {
			t.Fatal("bad config accepted", v)
		}
	}
	if _, e = LoadExperience(p + "missing"); e == nil {
		t.Fatal("missing config accepted")
	}
}

func TestExperienceWeightsAndStopSettings(t *testing.T) {
	p := filepath.Join(t.TempDir(), "experience.json")
	base := `{"enabled":false,"createMinSeconds":30,"createMaxSeconds":120,"playMinSeconds":10,"playMaxSeconds":30`
	for _, suffix := range []string{`,"gameWeights":{"AG1":-1}}`, `,"gameWeights":{"../AG2":1}}`, `,"stopEveryRounds":0}`, `,"stopChancePercent":101}`, `,"stopChancePercent":-1}`} {
		if err := os.WriteFile(p, []byte(base+suffix), 0600); err != nil {
			t.Fatal(err)
		}
		if _, err := LoadExperience(p); err == nil {
			t.Fatal("invalid settings accepted", suffix)
		}
	}
	if err := os.WriteFile(p, []byte(base+`}`), 0600); err != nil {
		t.Fatal(err)
	}
	legacy, err := LoadExperience(p)
	if err != nil {
		t.Fatal(err)
	}
	every, chance := legacy.StopPolicy()
	if every != 50 || chance != 20 || legacy.Weights()["AG1"] != 1 {
		t.Fatal("legacy behavior changed", legacy)
	}
	if err := os.WriteFile(p, []byte(base+`,"gameWeights":{"AG2":1},"stopEveryRounds":7,"stopChancePercent":0}`), 0600); err != nil {
		t.Fatal(err)
	}
	cfg, err := LoadExperience(p)
	if err != nil {
		t.Fatal(err)
	}
	every, chance = cfg.StopPolicy()
	if every != 7 || chance != 0 || cfg.Weights()["AG2"] != 1 {
		t.Fatal(cfg)
	}
}

func TestExperienceFundingConfiguration(t *testing.T) {
	p := filepath.Join(t.TempDir(), "experience.json")
	base := `{"enabled":false,"createMinSeconds":30,"createMaxSeconds":120,"playMinSeconds":10,"playMaxSeconds":30`
	for _, tc := range []struct {
		name, suffix string
		valid        bool
	}{
		{"legacy", `}`, true},
		{"custom", `,"initialCoinsMin":5000000,"initialCoinsMax":10000000,"initialCoinsStep":1000000,"betDivisorMin":20,"betDivisorMax":50}`, true},
		{"fixed", `,"initialCoinsMin":50000,"initialCoinsMax":50000,"initialCoinsStep":100,"betDivisorMin":20,"betDivisorMax":20}`, true},
		{"zero balance", `,"initialCoinsMin":0}`, false},
		{"reversed balance", `,"initialCoinsMin":2000000}`, false},
		{"zero step", `,"initialCoinsStep":0}`, false},
		{"unaligned range", `,"initialCoinsStep":9999}`, false},
		{"unsafe amount", `,"initialCoinsMax":9007199254740992}`, false},
		{"zero divisor", `,"betDivisorMin":0}`, false},
		{"reversed divisor", `,"betDivisorMin":301}`, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if err := os.WriteFile(p, []byte(base+tc.suffix), 0600); err != nil {
				t.Fatal(err)
			}
			cfg, err := LoadExperience(p)
			if (err == nil) != tc.valid {
				t.Fatalf("valid=%v err=%v", tc.valid, err)
			}
			if err == nil && tc.name == "legacy" {
				min, max, step, dmin, dmax := cfg.FundingPolicy()
				if min != 10000 || max != 1000000 || step != 10000 || dmin != 100 || dmax != 300 {
					t.Fatal("legacy funding changed")
				}
			}
		})
	}
}
