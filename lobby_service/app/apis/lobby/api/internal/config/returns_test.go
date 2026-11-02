package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestReturnConfig(t *testing.T) {
	for _, tc := range []struct {
		body  string
		valid bool
	}{
		{`{"dailyRateBps":80,"weeklyRateBps":10,"monthlyRateBps":10,"loserReturnRateBps":1000}`, true},
		{`{"dailyRateBps":0,"weeklyRateBps":0,"monthlyRateBps":0,"loserReturnRateBps":10000}`, true},
		{`{}`, false},
		{`{"dailyRateBps":-1,"weeklyRateBps":10,"monthlyRateBps":10,"loserReturnRateBps":1000}`, false},
		{`{"dailyRateBps":80,"weeklyRateBps":10001,"monthlyRateBps":10,"loserReturnRateBps":1000}`, false},
		{`{"dailyRateBps":0.8,"weeklyRateBps":10,"monthlyRateBps":10,"loserReturnRateBps":1000}`, false},
		{`{"dailyRateBps":80,"weeklyRateBps":10,"monthlyRateBps":10,"loserReturnRateBps":1000,"typo":1}`, false},
		{`{} {}`, false},
	} {
		path := filepath.Join(t.TempDir(), "returns.json")
		if err := os.WriteFile(path, []byte(tc.body), 0o600); err != nil {
			t.Fatal(err)
		}
		c, err := LoadReturns(path)
		if (err == nil) != tc.valid {
			t.Fatal(c, err)
		}
	}
}
