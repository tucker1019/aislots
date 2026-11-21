package adminconfig

import (
	"encoding/json"
	"os"
	"testing"

	"apps/app/apis/lobby/api/internal/config"
)

func TestDocumentsValidateAllSeedSections(t *testing.T) {
	for _, section := range Sections {
		t.Run(section.Key, func(t *testing.T) {
			b, e := os.ReadFile("../../../../../../etc/" + section.Key + ".json")
			if e != nil {
				t.Fatal(e)
			}
			if e = ValidateDocument(section.Key, b); e != nil {
				t.Fatal(e)
			}
		})
	}
}

func TestDocumentsRejectUnknownOrUnsafeValues(t *testing.T) {
	for _, tc := range []struct{ key, document string }{
		{"recharge", `[{"id":"x","amount":100,"bonus":0,"fee":0,"unknown":true}]`},
		{"recharge", `[{"id":"x","amount":9007199254740992,"bonus":0,"fee":0}]`},
		{"experience", `{"enabled":true,"createMinSeconds":0,"createMaxSeconds":1,"playMinSeconds":1,"playMaxSeconds":2}`},
		{"games", `{"appname":"a","appkey":"b","country":"ID","currency":"IDR","games":{},"serviceToken":"secret"}`},
		{"not-a-section", `{}`},
	} {
		if e := ValidateDocument(tc.key, []byte(tc.document)); e == nil {
			t.Errorf("accepted invalid %s", tc.key)
		}
	}
}

func TestPublishedDocumentPreservesImmutableSettings(t *testing.T) {
	old := config.Config{Checkin: config.CheckinConfig{Timezone: "Asia/Jakarta"}, Game: config.GameConfig{AppName: "lobby", AppKey: "lobby", Country: "ID", Currency: "IDR"}}
	check := func(key string, v any) {
		t.Helper()
		b, _ := json.Marshal(v)
		if e := checkImmutable(old, key, b); e == nil {
			t.Fatalf("accepted immutable %s", key)
		}
	}
	check("checkin", config.CheckinConfig{Timezone: "UTC"})
	check("games", config.GameConfig{AppName: "another", AppKey: "lobby", Country: "ID", Currency: "IDR"})
}

func TestGameRTPAllowsDecimalsWithoutRelaxingIntegerSettings(t *testing.T) {
	for _, tc := range []struct {
		field string
		valid bool
	}{
		{`"theoreticalRtp":97.03`, true},
		{`"theoreticalRtp":97.1`, true},
		{`"theoreticalRtp":0`, true},
		{`"theoreticalRtp":100`, true},
		{`"theoreticalRtp":100.01`, false},
		{`"theoreticalRtp":-0.01`, false},
		{`"maxWin":5000.5`, false},
		{`"sort":1.5`, false},
	} {
		document := `{"appname":"lobby","appkey":"web","country":"ID","currency":"IDR","games":{"AG1":{` + tc.field + `}}}`
		err := ValidateDocument("games", []byte(document))
		if (err == nil) != tc.valid {
			t.Fatalf("%s: %v", tc.field, err)
		}
	}
	if err := ValidateDocument("recharge", []byte(`[{"id":"one","amount":100.5,"bonus":0,"fee":0}]`)); err == nil {
		t.Fatal("fractional money accepted")
	}
	if err := ValidateDocument("experience", []byte(`{"enabled":true,"createMinSeconds":30.5,"createMaxSeconds":120,"playMinSeconds":10,"playMaxSeconds":30}`)); err == nil {
		t.Fatal("fractional interval accepted")
	}
	if err := withDocument("games", []byte(`{"other":{"AG1":{"theoreticalRtp":97.03}}}`), func(string) error { return nil }); err == nil {
		t.Fatal("decimal exception escaped game RTP path")
	}
}

func TestLossAndRebateDocumentsStayIndependent(t *testing.T) {
	c := config.Config{Returns: config.ReturnConfig{DailyRateBps: 80, WeeklyRateBps: 10, MonthlyRateBps: 10, LoserReturnRateBps: 1000, PlatformFeeRateBps: 1000, RewardSources: map[string]bool{"checkin": true}}}
	// Legacy rebate documents remain readable, but cannot overwrite independent loss settings.
	if e := applyDocument(&c, "returns", []byte(`{"dailyRateBps":90,"weeklyRateBps":20,"monthlyRateBps":30,"loserReturnRateBps":9999}`)); e != nil {
		t.Fatal(e)
	}
	if c.Returns.DailyRateBps != 90 || c.Returns.LoserReturnRateBps != 1000 || c.Returns.PlatformFeeRateBps != 1000 || !c.Returns.RewardSources["checkin"] {
		t.Fatal(c.Returns)
	}
	if e := applyDocument(&c, "loss-return", []byte(`{"loserReturnRateBps":0,"platformFeeRateBps":0,"rewardSources":{"checkin":false,"inviteReward":true}}`)); e != nil {
		t.Fatal(e)
	}
	if c.Returns.DailyRateBps != 90 || c.Returns.LoserReturnRateBps != 0 || c.Returns.PlatformFeeRateBps != 0 || c.Returns.RewardSources["checkin"] || !c.Returns.RewardSources["inviteReward"] {
		t.Fatal(c.Returns)
	}
	if e := ValidateDocument("returns", []byte(`{"dailyRateBps":80,"weeklyRateBps":10,"monthlyRateBps":10}`)); e != nil {
		t.Fatal(e)
	}
	for _, doc := range []string{
		`{"loserReturnRateBps":1000,"platformFeeRateBps":1000,"rewardSources":{"unknown":true}}`,
		`{"loserReturnRateBps":1000,"platformFeeRateBps":10001,"rewardSources":{}}`,
		`{"loserReturnRateBps":1000,"platformFeeRateBps":-1,"rewardSources":{}}`,
		`{"loserReturnRateBps":1000,"rewardSources":{}}`,
		`{"loserReturnRateBps":1000,"platformFeeRateBps":1000,"rewardSources":null}`,
		`{"loserReturnRateBps":1000,"platformFeeRateBps":1000,"rewardSources":{},"extra":1}`,
	} {
		if e := ValidateDocument("loss-return", []byte(doc)); e == nil {
			t.Fatal("accepted", doc)
		}
	}
}

func TestPublishedTurnoverDocumentAddsNewSourceDefaults(t *testing.T) {
	b, err := os.ReadFile("../../../../../../etc/turnover.json")
	if err != nil {
		t.Fatal(err)
	}
	var value config.TurnoverConfig
	if err := json.Unmarshal(b, &value); err != nil {
		t.Fatal(err)
	}
	delete(value.Multipliers, "act_008")
	legacy, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	base, err := config.LoadTurnover("../../../../../../etc/turnover.json")
	if err != nil {
		t.Fatal(err)
	}
	c := config.Config{Turnover: base}
	if err := applyDocument(&c, "turnover", legacy); err != nil {
		t.Fatal(err)
	}
	if got := c.Turnover.Multipliers["act_008"]; got != base.Multipliers["act_008"] {
		t.Fatalf("act_008 default = %d, want %d", got, base.Multipliers["act_008"])
	}
}
