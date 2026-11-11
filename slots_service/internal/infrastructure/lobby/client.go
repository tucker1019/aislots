// Package lobby adapts the independent lobby's authenticated HTTP contract.
package lobby

import (
	"aislots/slots_service/internal/application/play"
	"aislots/slots_service/internal/domain/identity"
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Enabled  bool     `json:"enabled"`
	URL      string   `json:"url"`
	TokenEnv string   `json:"tokenEnv"`
	AppName  string   `json:"appname"`
	AppKey   string   `json:"appkey"`
	GameID   string   `json:"gameId"`
	GameIDs  []string `json:"gameIds,omitempty"`
}
type Client struct {
	config Config
	secret string
	http   *http.Client
}

func New(c Config, secret string) (*Client, error) {
	u, e := url.Parse(c.URL)
	if e != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") || u.User != nil || u.RawQuery != "" || u.Fragment != "" || len(secret) < 32 || c.AppName == "" || c.AppKey == "" || c.GameID == "" {
		return nil, fmt.Errorf("invalid lobby adapter configuration")
	}
	c.URL = strings.TrimRight(c.URL, "/")
	return &Client{c, secret, &http.Client{Timeout: 8 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}, nil
}
func (c *Client) supportsGame(game string) bool {
	if game == c.config.GameID {
		return true
	}
	for _, id := range c.config.GameIDs {
		if id == game && id != "" {
			return true
		}
	}
	return false
}
func (c *Client) Matches(p identity.Context) bool {
	return p.Subject.AppName == c.config.AppName && p.Subject.AppKey == c.config.AppKey
}

type responseError int

func (e responseError) Error() string { return fmt.Sprintf("lobby returned HTTP %d", int(e)) }

func (c *Client) call(ctx context.Context, path string, in, out any) error {
	b, e := json.Marshal(in)
	if e != nil {
		return e
	}
	r, e := http.NewRequestWithContext(ctx, "POST", c.config.URL+path, bytes.NewReader(b))
	if e != nil {
		return e
	}
	r.Header.Set("Authorization", "Bearer "+c.secret)
	r.Header.Set("Content-Type", "application/json")
	res, e := c.http.Do(r)
	if e != nil {
		return fmt.Errorf("lobby temporarily unavailable")
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return responseError(res.StatusCode)
	}
	var body struct {
		Code json.RawMessage
		Data json.RawMessage
	}
	if e = json.NewDecoder(io.LimitReader(res.Body, 2<<20)).Decode(&body); e != nil || string(body.Code) != `"OK"` {
		return fmt.Errorf("invalid lobby response")
	}
	return json.Unmarshal(body.Data, out)
}
func (c *Client) VerifyLaunch(ctx context.Context, ticket, exchange, game string) (identity.Context, int64, string, error) {
	if !c.supportsGame(game) || len(ticket) != 52 || len(exchange) < 16 || len(exchange) > 128 {
		return identity.Context{}, 0, "", fmt.Errorf("invalid launch credential")
	}
	var out struct {
		UID      int64  `json:"uid"`
		AppName  string `json:"appname"`
		AppKey   string `json:"appkey"`
		Country  string
		Currency string
		Coins    int64
	}
	e := c.call(ctx, "/internal/game/exchange", map[string]any{"launchTicket": ticket, "exchangeId": exchange, "gameId": game}, &out)
	if e != nil {
		if status, ok := e.(responseError); ok && status == 401 {
			return identity.Context{}, 0, "", play.ErrUnauthorized
		}
		return identity.Context{}, 0, "", e
	}
	p := identity.Context{Subject: identity.Subject{AppName: out.AppName, AppKey: out.AppKey, UID: strconv.FormatInt(out.UID, 10)}, Country: out.Country, Currency: out.Currency}
	if !p.Valid() || !c.Matches(p) || out.UID <= 0 || out.Coins < 0 {
		return p, 0, "", fmt.Errorf("invalid lobby identity")
	}
	// Stable across retries and service restarts, but not derivable from the public ticket alone.
	h := hmac.New(sha256.New, []byte(c.secret))
	h.Write([]byte("game-session\x00" + game + "\x00" + ticket + "\x00" + exchange))
	return p, out.Coins, hex.EncodeToString(h.Sum(nil)), nil
}
func (c *Client) Balance(ctx context.Context, p identity.Context) (int64, error) {
	uid, e := strconv.ParseInt(p.Subject.UID, 10, 64)
	if e != nil || uid <= 0 || !c.Matches(p) {
		return 0, fmt.Errorf("invalid lobby identity")
	}
	var out struct{ Coins int64 }
	e = c.call(ctx, "/internal/game/balance", map[string]any{"uid": uid, "gameId": c.config.GameID}, &out)
	if e == nil && out.Coins < 0 {
		e = fmt.Errorf("invalid wallet balance")
	}
	return out.Coins, e
}

type Settlement struct {
	RequestID string `json:"requestId"`
	UID       int64  `json:"uid"`
	GameID    string `json:"gameId"`
	BetID     string `json:"betId"`
	Debit     int64  `json:"debit"`
	Credit    int64  `json:"credit"`
}

func (c *Client) Settle(ctx context.Context, in Settlement) (string, int64, error) {
	var out struct {
		Status string
		Coins  int64
	}
	e := c.call(ctx, "/internal/game/settle", in, &out)
	if e == nil && (out.Coins < 0 || (out.Status != "confirmed" && out.Status != "rejected")) {
		e = fmt.Errorf("invalid settlement receipt")
	}
	return out.Status, out.Coins, e
}

type Completion struct {
	UID       int64     `json:"uid"`
	GameID    string    `json:"gameId"`
	BetID     string    `json:"betId"`
	Sequence  int64     `json:"sequence"`
	BetAmount int64     `json:"betAmount"`
	WinAmount int64     `json:"winAmount"`
	StartedAt time.Time `json:"startedAt"`
	EndedAt   time.Time `json:"endedAt"`
}

func (c *Client) Complete(ctx context.Context, in Completion) error {
	var out struct{ Included bool }
	return c.call(ctx, "/internal/game/complete", in, &out)
}

// AutoPlayer accepts only a trusted internal command, under this adapter's configured identity.
func (c *Client) AutoPlayer(uid int64, country, currency string) (identity.Context, error) {
	p := identity.Context{Subject: identity.Subject{AppName: c.config.AppName, AppKey: c.config.AppKey, UID: strconv.FormatInt(uid, 10)}, Country: country, Currency: currency}
	if uid <= 0 || !p.Valid() {
		return identity.Context{}, play.ErrInvalid
	}
	return p, nil
}
