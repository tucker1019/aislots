package config

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"regexp"
	"strings"
)

var gameIDPattern = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_-]{0,63}$`)

type GameEntry struct {
	Cover    string `json:"cover"`
	NameEn   string `json:"nameEn"`
	Sort     int32  `json:"sort"`
	Visible  *bool  `json:"visible,omitempty"`
	APIURL   string `json:"apiUrl"`
	Provider string `json:"provider"`
	Name     string `json:"name"`
	Enabled  bool   `json:"enabled"`
	URL      string `json:"url"`
}

func (g GameEntry) IsVisible() bool { return g.Visible == nil || *g.Visible }

type GameConfig struct {
	AppName      string               `json:"appname"`
	AppKey       string               `json:"appkey"`
	Country      string               `json:"country"`
	Currency     string               `json:"currency"`
	Games        map[string]GameEntry `json:"games"`
	ServiceToken string               `json:"-"`
}

func LoadGames(path string) (GameConfig, error) {
	if path == "" {
		path = "etc/games.json"
	}
	var c GameConfig
	b, e := os.ReadFile(path)
	if e != nil {
		return c, e
	}
	if e = json.Unmarshal(b, &c); e != nil {
		return c, e
	}
	c.ServiceToken = os.Getenv("LOBBY_GAME_SERVICE_TOKEN")
	if c.AppName == "" || c.AppKey == "" || c.Country == "" || c.Currency == "" {
		return c, fmt.Errorf("invalid game identity configuration")
	}
	for id, g := range c.Games {
		if !gameIDPattern.MatchString(id) || g.Sort < 0 || (g.Cover != "" && !contentImage(g.Cover)) {
			return c, fmt.Errorf("invalid game display configuration %s", id)
		}
		if g.Visible != nil && *g.Visible && (strings.TrimSpace(g.Name) == "" || strings.TrimSpace(g.Provider) == "" || g.Cover == "") {
			return c, fmt.Errorf("visible game %s requires name, provider and cover", id)
		}
		if g.APIURL != "" {
			a, e := url.Parse(g.APIURL)
			if e != nil || a.Host == "" || (a.Scheme != "http" && a.Scheme != "https") || a.User != nil || a.RawQuery != "" || a.Fragment != "" {
				return c, fmt.Errorf("invalid game API entry %s", id)
			}
		}
		if !g.Enabled && g.URL == "" {
			continue
		}
		u, e := url.Parse(g.URL)
		if id == "" || e != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
			return c, fmt.Errorf("invalid game entry %s", id)
		}
	}
	if c.ServiceToken != "" && len(c.ServiceToken) < 32 {
		return c, fmt.Errorf("game service token must have at least 32 characters")
	}
	return c, nil
}
