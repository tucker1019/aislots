package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestInviteConfig(t *testing.T) {
	c := InviteConfig{Version: "v1", DurationDays: 30, MinDepositCount: 5, MinDepositAmount: 50000, MinBetAmount: 500000, RewardAmount: 20000, DisplayRows: 10, BaseURL: "https://example.com/", SupportURL: "https://t.me/tucker881"}
	file := filepath.Join(t.TempDir(), "invite.json")
	check := func(value InviteConfig, valid bool) {
		t.Helper()
		b, _ := json.Marshal(value)
		if e := os.WriteFile(file, b, 0600); e != nil {
			t.Fatal(e)
		}
		v, e := LoadInvite(file)
		if (e == nil) != valid {
			t.Fatal(v, e)
		}
	}
	check(c, true)
	bad := c
	bad.DurationDays = 0
	check(bad, false)
	bad = c
	bad.MinDepositCount = 0
	check(bad, false)
	bad = c
	bad.RewardAmount = 0
	check(bad, false)
	bad = c
	bad.BaseURL = "javascript:alert(1)"
	check(bad, false)
	bad = c
	bad.SupportURL = "https://u:p@example.com"
	check(bad, false)
	os.WriteFile(file, []byte(`{} {}`), 0600)
	if _, e := LoadInvite(file); e == nil {
		t.Fatal("trailing config")
	}
	os.WriteFile(file, []byte(`{"unknown":1}`), 0600)
	if _, e := LoadInvite(file); e == nil {
		t.Fatal("unknown field")
	}
	if _, e := LoadInvite(file + "missing"); e == nil {
		t.Fatal("missing config")
	}
}
