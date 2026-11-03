package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
)

type Config struct {
	Game          GameConfig
	Address       string
	DatabaseURL   string
	SessionDays   int
	RechargeTiers []RechargeTier
	Checkin       CheckinConfig
	Returns       ReturnConfig
	VIP           VIPConfig
	Invite        InviteConfig
	Newbie        NewbieConfig
}

func (c Config) SessionTTL() time.Duration { return time.Duration(c.SessionDays) * 24 * time.Hour }
func Load() (Config, error) {
	c := Config{Address: os.Getenv("LOBBY_HTTP_ADDRESS"), DatabaseURL: os.Getenv("LOBBY_DATABASE_URL"), SessionDays: 60}
	if c.Address == "" {
		c.Address = "127.0.0.1:8081"
	}
	if c.DatabaseURL == "" {
		return c, fmt.Errorf("LOBBY_DATABASE_URL is required")
	}
	db, err := pgx.ParseConfig(c.DatabaseURL)
	if err != nil {
		return c, err
	}
	if db.Database != "aislots_lobby" {
		return c, fmt.Errorf("dedicated database aislots_lobby required")
	}
	if v := os.Getenv("LOBBY_SESSION_DAYS"); v != "" {
		c.SessionDays, err = strconv.Atoi(v)
		if err != nil || c.SessionDays < 1 || c.SessionDays > 3650 {
			return c, fmt.Errorf("LOBBY_SESSION_DAYS must be between 1 and 3650")
		}
	}
	c.Game, err = LoadGames(os.Getenv("LOBBY_GAMES_CONFIG"))
	if err != nil {
		return c, err
	}
	c.RechargeTiers, err = LoadRechargeTiers(os.Getenv("LOBBY_RECHARGE_CONFIG"))
	if err != nil {
		return c, err
	}
	c.Checkin, err = LoadCheckin(os.Getenv("LOBBY_CHECKIN_CONFIG"))
	if err != nil {
		return c, err
	}
	c.Returns, err = LoadReturns(os.Getenv("LOBBY_RETURN_CONFIG"))
	if err != nil {
		return c, err
	}
	c.VIP, err = LoadVIP(os.Getenv("LOBBY_VIP_CONFIG"))
	if err != nil {
		return c, err
	}
	c.Newbie, err = LoadNewbie(os.Getenv("LOBBY_NEWBIE_RECHARGE_CONFIG"))
	if err != nil {
		return c, err
	}
	c.Invite, err = LoadInvite(os.Getenv("LOBBY_INVITE_CONFIG"))
	if err != nil {
		return c, err
	}
	return c, nil
}
