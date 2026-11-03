package config

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
)

type GameEntry struct {
	Provider string `json:"provider"`
	Name     string `json:"name"`
	Enabled  bool   `json:"enabled"`
	URL      string `json:"url"`
}
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
