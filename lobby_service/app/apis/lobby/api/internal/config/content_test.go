package config

import (
	"os"
	"testing"
)

func TestContentRejectsUnsafeDestinations(t *testing.T) {
	for _, part := range []string{`"route":"https://evil.example"`, `"route":"/earn","imageZhTw":"javascript:alert(1)"`, `"route":"/earn","imageZhTw":"//evil.example/banner.webp"`} {
		p := t.TempDir() + "/content.json"
		body := `{"announcements":{"zh-TW":["notice"],"en-US":["notice"]},"banners":[{"id":"a","enabled":true,"imageZhTw":"/assets/a.webp","imageEnUs":"/assets/a.webp","altZhTw":"banner","altEnUs":"banner",` + part + `}]}`
		// Injected duplicate keys must not weaken the final validation of a destination.
		if e := os.WriteFile(p, []byte(body), 0600); e != nil {
			t.Fatal(e)
		}
		if _, e := LoadContent(p); e == nil {
			t.Fatal("unsafe banner accepted")
		}
	}
}
func TestContentAcceptsDefault(t *testing.T) {
	if _, e := LoadContent("../../../../../../etc/content.json"); e != nil {
		t.Fatal(e)
	}
}
