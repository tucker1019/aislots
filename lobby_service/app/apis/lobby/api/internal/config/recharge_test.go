package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestRechargeConfig(t *testing.T) {
	for _, test := range []struct {
		body  string
		valid bool
	}{
		{`[{"id":"bonus","amount":10000,"bonus":1000,"fee":0},{"id":"fee","amount":10000,"fee":200}]`, true},
		{`[]`, true},
		{`[{"id":"bad","amount":100,"bonus":1,"fee":1}]`, false},
		{`[{"id":"bad","amount":100,"fee":100}]`, false},
		{`[{"id":"bad","amount":-1}]`, false},
		{`[{"id":"bad","amount":9223372036854775807,"bonus":1}]`, false},
		{`[{"id":"a","amount":100},{"id":"a","amount":200}]`, false},
		{`[{"id":"a","amount":100,"unknown":1}]`, false},
		{`[] {}`, false},
	} {
		t.Run(test.body, func(t *testing.T) {
			p := filepath.Join(t.TempDir(), "tiers.json")
			if err := os.WriteFile(p, []byte(test.body), 0o600); err != nil {
				t.Fatal(err)
			}
			tiers, err := LoadRechargeTiers(p)
			if (err == nil) != test.valid {
				t.Fatal(tiers, err)
			}
		})
	}
}
