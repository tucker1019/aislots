package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestExperienceConfig(t *testing.T) {
	c, e := LoadExperience("../../../../../../etc/experience.json")
	if e != nil || c.CreateMinSeconds != 30 || !c.Enabled {
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
