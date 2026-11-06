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
