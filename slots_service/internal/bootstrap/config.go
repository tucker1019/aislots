package bootstrap

import (
	"aislots/slots_service/internal/application/play"
	"aislots/slots_service/internal/infrastructure/lobby"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"time"
)

type DatabaseConfig struct {
	URLEnv      string `json:"urlEnv"`
	AutoMigrate bool   `json:"autoMigrate"`
}
type Config struct {
	Lobby           lobby.Config     `json:"lobby"`
	Database        DatabaseConfig   `json:"database"`
	TestProfile     play.TestProfile `json:"testProfile"`
	BetPoliciesFile string           `json:"betPoliciesFile"`
	AllowedOrigins  []string         `json:"allowedOrigins"`
	HTTP            HTTPConfig       `json:"http"`
	Games           []GameConfig     `json:"games"`
}
type HTTPConfig struct {
	Address                  string `json:"address"`
	ReadHeaderTimeoutSeconds int    `json:"readHeaderTimeoutSeconds"`
	ReadTimeoutSeconds       int    `json:"readTimeoutSeconds"`
	WriteTimeoutSeconds      int    `json:"writeTimeoutSeconds"`
	IdleTimeoutSeconds       int    `json:"idleTimeoutSeconds"`
	ShutdownTimeoutSeconds   int    `json:"shutdownTimeoutSeconds"`
}
type GameConfig struct {
	RuleType              string      `json:"-"`
	ConfigDir             string      `json:"configDir"`
	BaseLibraryDir        string      `json:"baseLibraryDir"`
	FreeLibraryDir        string      `json:"freeLibraryDir"`
	TriggerSymbolCount    int         `json:"triggerSymbolCount"`
	FreeAwardSymbolCounts map[int]int `json:"freeAwardSymbolCounts,omitempty"`
	MaxFillAttempts       int         `json:"maxFillAttempts"`
	Current               bool        `json:"current"`
}

func LoadConfig(path string) (Config, error) {
	var c Config
	f, err := os.Open(path)
	if err != nil {
		return c, err
	}
	defer f.Close()
	d := json.NewDecoder(f)
	d.DisallowUnknownFields()
	if err = d.Decode(&c); err != nil {
		return c, err
	}
	if err = d.Decode(new(any)); err != io.EOF {
		return c, fmt.Errorf("trailing configuration data")
	}
	if _, _, err = net.SplitHostPort(c.HTTP.Address); err != nil {
		return c, fmt.Errorf("http.address: %w", err)
	}
	for _, seconds := range []int{c.HTTP.ReadHeaderTimeoutSeconds, c.HTTP.ReadTimeoutSeconds, c.HTTP.WriteTimeoutSeconds, c.HTTP.IdleTimeoutSeconds, c.HTTP.ShutdownTimeoutSeconds} {
		if seconds < 1 || seconds > 3600 {
			return c, fmt.Errorf("HTTP timeouts must be 1..3600 seconds")
		}
	}
	for i := range c.Games {
		g := &c.Games[i]
		if g.ConfigDir == "" {
			return c, fmt.Errorf("invalid games[%d] settings", i)
		}
		for _, p := range []*string{&g.ConfigDir, &g.BaseLibraryDir, &g.FreeLibraryDir} {
			if *p != "" && !filepath.IsAbs(*p) {
				*p = filepath.Join(filepath.Dir(path), *p)
			}
		}
	}
	if c.Lobby.Enabled && (c.Database.URLEnv == "" || c.BetPoliciesFile == "" || c.Lobby.TokenEnv == "" || c.Lobby.GameID == "" || c.TestProfile.Enabled) {
		return c, fmt.Errorf("live lobby requires database and bet policies; test profile must be disabled")
	}
	if c.TestProfile.Enabled {
		if c.Database.URLEnv == "" || c.BetPoliciesFile == "" || !c.TestProfile.Player().Valid() || c.TestProfile.InitialBalance < 1 {
			return c, fmt.Errorf("explicit database, bet policies and test profile required")
		}
	}
	if c.BetPoliciesFile != "" && !filepath.IsAbs(c.BetPoliciesFile) {
		c.BetPoliciesFile = filepath.Join(filepath.Dir(path), c.BetPoliciesFile)
	}
	return c, nil
}
func Seconds(n int) time.Duration { return time.Duration(n) * time.Second }
