package config

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"net/url"
	"os"
	"regexp"
	"strings"
)

var gameIDPattern = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9_-]{0,63}$`)

type GameEntry struct {
	TheoreticalRtp *float64 `json:"theoreticalRtp,omitempty"`
	Volatility     string   `json:"volatility,omitempty"`
	MaxWin         *int64   `json:"maxWin,omitempty"`
	Cover          string   `json:"cover"`
	NameEn         string   `json:"nameEn"`
	Sort           int32    `json:"sort"`
	Visible        *bool    `json:"visible,omitempty"`
	APIURL         string   `json:"apiUrl"`
	Provider       string   `json:"provider"`
	Name           string   `json:"name"`
	Enabled        bool     `json:"enabled"`
	URL            string   `json:"url"`
}

// Defaults apply only when fields are absent, including legacy published documents.
func (g *GameEntry) UnmarshalJSON(data []byte) error {
	type entry GameEntry
	rtp, maxWin := 97.0, int64(-1)
	value := entry{TheoreticalRtp: &rtp, Volatility: "medium", MaxWin: &maxWin}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&value); err != nil {
		return err
	}
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	for _, key := range []string{"theoreticalRtp", "volatility", "maxWin"} {
		if bytes.Equal(bytes.TrimSpace(raw[key]), []byte("null")) {
			return fmt.Errorf("%s cannot be null", key)
		}
	}
	*g = GameEntry(value)
	return nil
}

func (g GameEntry) DisplayRTP() float64 {
	if g.TheoreticalRtp == nil {
		return 97
	}
	return *g.TheoreticalRtp
}
func (g GameEntry) DisplayMaxWin() int64 {
	if g.MaxWin == nil {
		return -1
	}
	return *g.MaxWin
}
func (g GameEntry) DisplayVolatility() string {
	if g.Volatility == "" {
		return "medium"
	}
	return g.Volatility
}

func (g GameEntry) validDisplayMetrics() bool {
	validVolatility := false
	for _, value := range []string{"low", "medium_low", "medium", "medium_high", "high", "extreme"} {
		if g.Volatility == value {
			validVolatility = true
		}
	}
	return !math.IsNaN(g.DisplayRTP()) && !math.IsInf(g.DisplayRTP(), 0) && g.DisplayRTP() >= 0 && g.DisplayRTP() <= 100 && validVolatility && (g.DisplayMaxWin() == -1 || g.DisplayMaxWin() > 0 && g.DisplayMaxWin() <= 9007199254740991)
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
		if !g.validDisplayMetrics() {
			return c, fmt.Errorf("invalid game display metrics %s", id)
		}
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
