package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewbieConfig(t *testing.T) {
	for _, tc := range []struct {
		body  string
		valid bool
	}{
		{`{"version":"v1","durationDays":3,"tiers":[{"id":"a","requiredRecharge":100,"reward":10},{"id":"b","requiredRecharge":500,"reward":50}]}`, true},
		{`{"version":"v1","durationDays":0,"tiers":[{"id":"a","requiredRecharge":100,"reward":10}]}`, false},
		{`{"version":"v1","durationDays":3,"tiers":[]}`, false},
		{`{"version":"v1","durationDays":3,"tiers":[{"id":"a","requiredRecharge":100,"reward":0}]}`, false},
		{`{"version":"v1","durationDays":3,"tiers":[{"id":"a","requiredRecharge":100,"reward":10},{"id":"a","requiredRecharge":500,"reward":50}]}`, false},
		{`{"version":"v1","durationDays":3,"tiers":[{"id":"a","requiredRecharge":500,"reward":10},{"id":"b","requiredRecharge":100,"reward":50}]}`, false},
		{`{"version":"v1","durationDays":3,"typo":1,"tiers":[]}`, false},
		{`{} {}`, false},
	} {
		path := filepath.Join(t.TempDir(), "newbie.json")
		if err := os.WriteFile(path, []byte(tc.body), 0o600); err != nil {
			t.Fatal(err)
		}
		c, err := LoadNewbie(path)
		if (err == nil) != tc.valid {
			t.Fatal(c, err)
		}
	}
}
