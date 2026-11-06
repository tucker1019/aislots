package contentservice

import (
	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/svc"
	"context"
	"google.golang.org/protobuf/encoding/protojson"
	"strings"
	"testing"
)

func TestPublicContentHasBothLanguagesAndNoDisabledOrPrivateSettings(t *testing.T) {
	c := config.Config{Game: config.GameConfig{ServiceToken: "private-service-secret", AppKey: "private-app-key"}, Content: config.ContentConfig{Announcements: map[string][]string{"zh-TW": {"notice-tw"}, "en-US": {"notice-en"}}, Banners: []config.ContentBanner{{ID: "hidden-banner", Enabled: false}, {ID: "visible-banner", Enabled: true, ImageZhTw: "/assets/tw.webp", ImageEnUs: "/assets/en.webp", AltZhTw: "tw", AltEnUs: "en", Route: "/earn"}}}}
	out, e := New(&svc.ServiceContext{Config: c}).Content(context.Background(), nil)
	if e != nil {
		t.Fatal(e)
	}
	if len(out.Announcements) != 2 || out.Announcements[0].Locale != "zh-TW" || out.Announcements[1].Items[0] != "notice-en" || len(out.Banners) != 1 || out.Banners[0].ImageEnUs != "/assets/en.webp" {
		t.Fatal(out)
	}
	b, e := protojson.Marshal(out)
	if e != nil {
		t.Fatal(e)
	}
	for _, secret := range []string{"private-service-secret", "private-app-key", "hidden-banner"} {
		if strings.Contains(string(b), secret) {
			t.Fatal("private/disabled content exposed")
		}
	}
}
