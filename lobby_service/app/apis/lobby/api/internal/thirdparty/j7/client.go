package j7

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const (
	DefaultGameAPIURL  = "https://api.j7slot.com"
	DefaultGameListURL = "https://api.ag777api.com/api/homeGameCategory"
	DefaultLanguage    = "en"
	DefaultCurrency    = "$"
)

type Config struct {
	AppID       string
	AppSecret   string
	GameAPIURL  string
	GameListURL string
	Language    string
	Currency    string
}

func LoadConfigFromEnv() Config {
	c := Config{
		AppID:       strings.TrimSpace(os.Getenv("J7_APP_ID")),
		AppSecret:   strings.TrimSpace(os.Getenv("J7_APP_SECRET")),
		GameAPIURL:  strings.TrimRight(strings.TrimSpace(os.Getenv("J7_GAME_API_URL")), "/"),
		GameListURL: strings.TrimSpace(os.Getenv("J7_GAME_LIST_URL")),
		Language:    strings.TrimSpace(os.Getenv("J7_LANGUAGE")),
		Currency:    strings.TrimSpace(os.Getenv("J7_CURRENCY")),
	}
	if c.GameAPIURL == "" {
		c.GameAPIURL = DefaultGameAPIURL
	}
	if c.GameListURL == "" {
		c.GameListURL = DefaultGameListURL
	}
	if c.Language == "" {
		c.Language = DefaultLanguage
	}
	if c.Currency == "" {
		c.Currency = DefaultCurrency
	}
	return c
}

func (c Config) Configured() bool {
	return c.AppID != "" && c.AppSecret != ""
}

type Client struct {
	Config Config
	HTTP   *http.Client
}

func NewClient(cfg Config) *Client {
	return &Client{
		Config: cfg,
		HTTP:   &http.Client{Timeout: 15 * time.Second},
	}
}

func (c *Client) httpClient() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return &http.Client{Timeout: 15 * time.Second}
}

type CategoryConfig struct {
	Title string `json:"title"`
}

type GameItem struct {
	GameCode string `json:"game_code"`
	GameName string `json:"game_name"`
	Icon     string `json:"icon"`
}

type Category struct {
	Config CategoryConfig `json:"config"`
	Game   []GameItem     `json:"game"`
}

type gameCategoryResponse struct {
	Code    int        `json:"code"`
	Data    []Category `json:"data"`
	Message string     `json:"message"`
}

func (c *Client) FetchGameCategories(ctx context.Context) ([]Category, error) {
	listURL := c.Config.GameListURL
	if listURL == "" {
		listURL = DefaultGameListURL
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, listURL, bytes.NewReader([]byte("{}")))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "aislots-lobby/1.0")
	resp, err := c.httpClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 4*1024*1024))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("j7 game list returned status %d", resp.StatusCode)
	}
	var parsed gameCategoryResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, fmt.Errorf("decode j7 game list: %w", err)
	}
	if parsed.Code != 200 {
		return nil, fmt.Errorf("j7 game list failed: code=%d message=%s", parsed.Code, parsed.Message)
	}
	return parsed.Data, nil
}

type launchRequest struct {
	UserID   string `json:"UserID"`
	GameID   string `json:"GameID"`
	Language string `json:"Language"`
	Currency string `json:"Currency"`
}

type launchResponse struct {
	Error string `json:"error"`
	Data  struct {
		URL string `json:"Url"`
	} `json:"data"`
}

func (c *Client) LaunchGame(ctx context.Context, userID, gameCode, language, currency string) (string, error) {
	if !c.Config.Configured() {
		return "", fmt.Errorf("j7 credentials not configured")
	}
	if language == "" {
		language = c.Config.Language
	}
	if currency == "" {
		currency = c.Config.Currency
	}
	payload, err := json.Marshal(launchRequest{
		UserID:   userID,
		GameID:   gameCode,
		Language: language,
		Currency: currency,
	})
	if err != nil {
		return "", err
	}
	endpoint := strings.TrimRight(c.Config.GameAPIURL, "/") + "/api/v1/game/launch"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "aislots-lobby/1.0")
	req.Header.Set("AppID", c.Config.AppID)
	req.Header.Set("AppSecret", c.Config.AppSecret)
	resp, err := c.httpClient().Do(req)
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("j7 launch returned status %d", resp.StatusCode)
	}
	var parsed launchResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", fmt.Errorf("decode j7 launch response: %w", err)
	}
	if parsed.Error != "" {
		return "", fmt.Errorf("j7 launch error: %s", parsed.Error)
	}
	u, err := url.Parse(strings.TrimSpace(parsed.Data.URL))
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return "", fmt.Errorf("j7 launch returned invalid url")
	}
	return u.String(), nil
}
