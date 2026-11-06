package config

import (
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"os"
	"path"
	"strings"
	"unicode/utf8"
)

type ContentBanner struct {
	ID        string `json:"id"`
	Enabled   bool   `json:"enabled"`
	ImageZhTw string `json:"imageZhTw"`
	ImageEnUs string `json:"imageEnUs"`
	AltZhTw   string `json:"altZhTw"`
	AltEnUs   string `json:"altEnUs"`
	Route     string `json:"route"`
}
type ContentConfig struct {
	Announcements map[string][]string `json:"announcements"`
	Banners       []ContentBanner     `json:"banners"`
}

func contentImage(v string) bool {
	if strings.HasPrefix(v, "/assets/") {
		return path.Clean(v) == v && !strings.ContainsAny(v, "\\%?#\r\n")
	}
	u, e := url.Parse(v)
	return e == nil && u.Scheme == "https" && u.Host != "" && u.User == nil && u.Fragment == "" && len(v) <= 2048
}
func LoadContent(file string) (ContentConfig, error) {
	var c ContentConfig
	if file == "" {
		file = "etc/content.json"
	}
	f, e := os.Open(file)
	if e != nil {
		return c, e
	}
	defer func() { _ = f.Close() }()
	d := json.NewDecoder(f)
	d.DisallowUnknownFields()
	if e = d.Decode(&c); e != nil {
		return c, e
	}
	if e = d.Decode(new(any)); e != io.EOF {
		return c, fmt.Errorf("trailing content document")
	}
	if len(c.Announcements) != 2 || c.Announcements["zh-TW"] == nil || c.Announcements["en-US"] == nil || c.Banners == nil || len(c.Banners) > 20 {
		return c, fmt.Errorf("content requires both locales, at most 20 banners")
	}
	for _, list := range c.Announcements {
		if len(list) > 20 {
			return c, fmt.Errorf("at most 20 announcements per locale")
		}
		for _, s := range list {
			if strings.TrimSpace(s) == "" || utf8.RuneCountInString(s) > 500 {
				return c, fmt.Errorf("announcements must contain 1-500 characters")
			}
		}
	}
	seen := map[string]bool{}
	for _, b := range c.Banners {
		if b.ID == "" || len(b.ID) > 64 || seen[b.ID] || !contentImage(b.ImageZhTw) || !contentImage(b.ImageEnUs) || strings.TrimSpace(b.AltZhTw) == "" || strings.TrimSpace(b.AltEnUs) == "" || utf8.RuneCountInString(b.AltZhTw) > 200 || utf8.RuneCountInString(b.AltEnUs) > 200 {
			return c, fmt.Errorf("invalid banner ID, localized images or descriptions")
		}
		seen[b.ID] = true
		if b.Route != "/" && b.Route != "/earn" && b.Route != "/deposit" && b.Route != "/offers" {
			return c, fmt.Errorf("banner route must be /, /earn, /deposit or /offers")
		}
	}
	return c, nil
}
