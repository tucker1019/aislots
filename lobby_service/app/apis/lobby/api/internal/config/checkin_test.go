package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestCheckinConfiguration(t *testing.T) {
	for _, test := range []struct {
		body  string
		valid bool
	}{
		{`{"version":"v1","timezone":"Asia/Jakarta","days":[{"requiredBet":0,"requiredRecharge":0,"reward":100}]}`, true},
		{`{"version":"v1","timezone":"Asia/Jakarta","days":[]}`, false},
		{`{"version":"v1","timezone":"bad","days":[{"reward":100}]}`, false},
		{`{"version":"v1","timezone":"UTC","days":[{"reward":0}]}`, false},
		{`{"version":"v1","timezone":"UTC","days":[{"requiredBet":-1,"reward":100}]}`, false},
		{`{"version":"v1","timezone":"UTC","days":[{"requiredRecharge":-1,"reward":100}]}`, false},
		{`{"version":"v1","timezone":"UTC","days":[{"reward":100}],"unknown":true}`, false},
		{`{} {}`, false},
	} {
		p := filepath.Join(t.TempDir(), "checkin.json")
		if err := os.WriteFile(p, []byte(test.body), 0o600); err != nil {
			t.Fatal(err)
		}
		c, err := LoadCheckin(p)
		if (err == nil) != test.valid {
			t.Fatal(c, err)
		}
	}
}
