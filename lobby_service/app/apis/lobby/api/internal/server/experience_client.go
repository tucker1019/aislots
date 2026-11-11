package server

import (
	"apps/app/apis/lobby/api/internal/config"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type experiencePolicy struct {
	Amounts             []int64
	LineCount, BetLevel int
}
type experienceClient struct {
	config   config.Config
	policies map[string]experiencePolicy
}

func (c *experienceClient) call(ctx context.Context, gameID, path string, input, output any) error {
	game, ok := c.config.Game.Games[gameID]
	if !ok || game.APIURL == "" || len(c.config.Game.ServiceToken) < 32 {
		return fmt.Errorf("experience service unavailable for %s", gameID)
	}
	body, err := json.Marshal(input)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, "POST", strings.TrimRight(game.APIURL, "/")+path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.config.Game.ServiceToken)
	client := http.Client{Timeout: 55 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	res, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("experience connection unavailable for %s", gameID)
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode != 200 {
		var failure struct{ Code string }
		_ = json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(&failure)
		if failure.Code == "INSUFFICIENT_FUNDS" {
			return errExperienceFunds
		}
		return fmt.Errorf("experience HTTP %d for %s", res.StatusCode, gameID)
	}
	return json.NewDecoder(io.LimitReader(res.Body, 1<<20)).Decode(output)
}
func (c *experienceClient) policy(ctx context.Context, gameID, country, currency string) (experiencePolicy, error) {
	key := gameID + ":" + country + ":" + currency
	if p, ok := c.policies[key]; ok {
		return p, nil
	}
	var reply struct {
		Code string
		Data experiencePolicy
	}
	if err := c.call(ctx, gameID, "/internal/auto-bets", map[string]any{"uid": 1, "gameId": gameID, "country": country, "currency": currency}, &reply); err != nil {
		return experiencePolicy{}, err
	}
	if reply.Code != "OK" || len(reply.Data.Amounts) == 0 || reply.Data.LineCount < 1 || reply.Data.BetLevel < 1 {
		return experiencePolicy{}, fmt.Errorf("invalid experience policy for %s", gameID)
	}
	c.policies[key] = reply.Data
	return reply.Data, nil
}
