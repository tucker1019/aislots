package userservice

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"apps/pkg/codec"
	"apps/pkg/xerr"
)

type TelegramAuthPayload struct {
	ID         int64  `json:"id"`
	FirstName  string `json:"first_name"`
	LastName   string `json:"last_name"`
	Username   string `json:"username"`
	PhotoURL   string `json:"photo_url"`
	AuthDate   int64  `json:"auth_date"`
	Hash       string `json:"hash"`
	InviteCode string `json:"inviteCode"`
}

func VerifyTelegramAuth(payload TelegramAuthPayload, botToken string, now time.Time) error {
	botToken = strings.TrimSpace(botToken)
	if botToken == "" {
		return xerr.ErrInvalid
	}
	if payload.ID <= 0 || payload.AuthDate <= 0 || strings.TrimSpace(payload.Hash) == "" {
		return xerr.ErrInvalid
	}
	// Reject stale auth payloads older than 24 hours or >5 minutes in the future.
	age := now.Unix() - payload.AuthDate
	if age > 86400 || age < -300 {
		return xerr.ErrCredentials
	}

	fields := map[string]string{
		"auth_date": strconv.FormatInt(payload.AuthDate, 10),
		"id":        strconv.FormatInt(payload.ID, 10),
	}
	if v := strings.TrimSpace(payload.FirstName); v != "" {
		fields["first_name"] = v
	}
	if v := strings.TrimSpace(payload.LastName); v != "" {
		fields["last_name"] = v
	}
	if v := strings.TrimSpace(payload.Username); v != "" {
		fields["username"] = v
	}
	if v := strings.TrimSpace(payload.PhotoURL); v != "" {
		fields["photo_url"] = v
	}

	keys := make([]string, 0, len(fields))
	for k := range fields {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	lines := make([]string, 0, len(keys))
	for _, k := range keys {
		lines = append(lines, fmt.Sprintf("%s=%s", k, fields[k]))
	}
	dataCheckString := strings.Join(lines, "\n")

	secretKey := sha256.Sum256([]byte(botToken))
	mac := hmac.New(sha256.New, secretKey[:])
	_, _ = mac.Write([]byte(dataCheckString))
	expected := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(strings.ToLower(strings.TrimSpace(payload.Hash))), []byte(expected)) {
		return xerr.ErrCredentials
	}
	return nil
}

func (s *Service) TelegramLogin(ctx context.Context, payload TelegramAuthPayload) (Identity, error) {
	return s.telegramLoginWithToken(ctx, payload, os.Getenv("TELEGRAM_BOT_TOKEN"), time.Now().UTC())
}

func (s *Service) telegramLoginWithToken(ctx context.Context, payload TelegramAuthPayload, botToken string, now time.Time) (Identity, error) {
	if err := VerifyTelegramAuth(payload, botToken, now); err != nil {
		return Identity{}, err
	}

	account := ""
	if uname := strings.TrimSpace(payload.Username); uname != "" {
		candidate := "@" + strings.ToLower(uname)
		if len(candidate) >= 3 && len(candidate) <= 64 {
			account = candidate
		}
	}
	if account == "" {
		account = fmt.Sprintf("tg:%d", payload.ID)
	}

	target, _, err := s.Store.Credentials(ctx, account)
	if err == nil && target > 0 {
		token, expiry := s.token()
		if err = s.Store.NewSession(ctx, target, Hash(token), expiry); err != nil {
			return Identity{}, err
		}
		return Identity{UID: target, SID: token, ExpiresAt: expiry}, nil
	}
	if err != nil && !errors.Is(err, xerr.ErrCredentials) {
		return Identity{}, err
	}

	randomPassword := rand.Text() + rand.Text()
	if len(randomPassword) > 64 {
		randomPassword = randomPassword[:64]
	}
	return s.Register(ctx, account, randomPassword, strings.TrimSpace(payload.InviteCode))
}

func (s *Service) TelegramLoginHTTP(w http.ResponseWriter, r *http.Request) {
	raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 16384))
	if err != nil {
		writeGoogleJSON(w, http.StatusBadRequest, map[string]any{"code": 10010001, "message": "invalid request"})
		return
	}
	raw, err = codec.DecryptRequest(r.Context(), raw)
	if err != nil {
		writeGoogleJSON(w, http.StatusBadRequest, map[string]any{"code": 10010001, "message": "invalid request"})
		return
	}
	var req TelegramAuthPayload
	if err := json.Unmarshal(raw, &req); err != nil {
		writeGoogleJSON(w, http.StatusBadRequest, map[string]any{"code": 10010001, "message": "invalid request"})
		return
	}
	id, err := s.TelegramLogin(r.Context(), req)
	if err != nil {
		status := http.StatusBadRequest
		code := 10010001
		if errors.Is(err, xerr.ErrCredentials) {
			status = http.StatusUnauthorized
			code = 10010003
		}
		writeGoogleJSON(w, status, map[string]any{"code": code, "message": xerr.Public(err).Error()})
		return
	}
	writeGoogleJSON(w, http.StatusOK, map[string]any{
		"code": "OK",
		"data": map[string]any{
			"uid":       id.UID,
			"sid":       id.SID,
			"expiresAt": id.ExpiresAt.Format(time.RFC3339Nano),
		},
	})
}

type telegramOidcRequest struct {
	Code         string `json:"code"`
	RedirectURI  string `json:"redirectUri"`
	CodeVerifier string `json:"codeVerifier"`
	InviteCode   string `json:"inviteCode"`
}

type telegramOidcTokenResponse struct {
	IDToken string `json:"id_token"`
}

type telegramOidcClaims struct {
	Iss               string `json:"iss"`
	Aud               any    `json:"aud"`
	Sub               string `json:"sub"`
	ID                any    `json:"id"`
	PreferredUsername string `json:"preferred_username"`
	Name              string `json:"name"`
	Exp               int64  `json:"exp"`
}

func (s *Service) TelegramOidcLogin(ctx context.Context, req telegramOidcRequest) (Identity, error) {
	code := strings.TrimSpace(req.Code)
	redirectURI := strings.TrimSpace(req.RedirectURI)
	verifier := strings.TrimSpace(req.CodeVerifier)
	if code == "" || redirectURI == "" {
		return Identity{}, xerr.ErrInvalid
	}

	clientID := strings.TrimSpace(os.Getenv("TELEGRAM_CLIENT_ID"))
	clientSecret := strings.TrimSpace(os.Getenv("TELEGRAM_CLIENT_SECRET"))
	if clientID == "" || clientSecret == "" {
		return Identity{}, xerr.ErrInvalid
	}

	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)
	form.Set("client_id", clientID)
	form.Set("client_secret", clientSecret)
	if verifier != "" {
		form.Set("code_verifier", verifier)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://oauth.telegram.org/token", strings.NewReader(form.Encode()))
	if err != nil {
		return Identity{}, err
	}
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	httpReq.Header.Set("Accept", "application/json")

	resp, err := defaultGoogleHTTPClient.Do(httpReq)
	if err != nil {
		slog.Warn("telegram oidc token request error", "err", err)
		return Identity{}, err
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 32768))
	if resp.StatusCode != http.StatusOK {
		slog.Warn("telegram oidc token exchange failed", "status", resp.StatusCode, "body", string(respBody), "redirectUri", redirectURI)
		return Identity{}, xerr.ErrCredentials
	}

	var tokenResp telegramOidcTokenResponse
	if err := json.Unmarshal(respBody, &tokenResp); err != nil || tokenResp.IDToken == "" {
		slog.Warn("telegram oidc invalid token response", "body", string(respBody))
		return Identity{}, xerr.ErrCredentials
	}

	parts := strings.Split(tokenResp.IDToken, ".")
	if len(parts) != 3 {
		return Identity{}, xerr.ErrCredentials
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return Identity{}, xerr.ErrCredentials
	}
	var claims telegramOidcClaims
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		slog.Warn("telegram oidc claims unmarshal failed", "err", err)
		return Identity{}, xerr.ErrCredentials
	}
	if strings.TrimRight(claims.Iss, "/") != "https://oauth.telegram.org" {
		slog.Warn("telegram oidc unexpected iss", "iss", claims.Iss)
		return Identity{}, xerr.ErrCredentials
	}

	account := ""
	if uname := strings.TrimSpace(claims.PreferredUsername); uname != "" {
		candidate := "@" + strings.ToLower(uname)
		if len(candidate) >= 3 && len(candidate) <= 64 {
			account = candidate
		}
	}
	if account == "" {
		if sub := strings.TrimSpace(claims.Sub); sub != "" {
			account = "tg:" + sub
			if len(account) > 64 {
				account = account[:64]
			}
		} else if claims.ID != nil {
			account = "tg:" + fmt.Sprint(claims.ID)
			if len(account) > 64 {
				account = account[:64]
			}
		} else {
			slog.Warn("telegram oidc missing sub/id")
			return Identity{}, xerr.ErrCredentials
		}
	}

	target, _, err := s.Store.Credentials(ctx, account)
	if err == nil && target > 0 {
		token, expiry := s.token()
		if err = s.Store.NewSession(ctx, target, Hash(token), expiry); err != nil {
			return Identity{}, err
		}
		return Identity{UID: target, SID: token, ExpiresAt: expiry}, nil
	}
	if err != nil && !errors.Is(err, xerr.ErrCredentials) {
		return Identity{}, err
	}

	randomPassword := rand.Text() + rand.Text()
	if len(randomPassword) > 64 {
		randomPassword = randomPassword[:64]
	}
	return s.Register(ctx, account, randomPassword, strings.TrimSpace(req.InviteCode))
}

func (s *Service) TelegramOidcLoginHTTP(w http.ResponseWriter, r *http.Request) {
	raw, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 16384))
	if err != nil {
		writeGoogleJSON(w, http.StatusBadRequest, map[string]any{"code": 10010001, "message": "invalid request"})
		return
	}
	raw, err = codec.DecryptRequest(r.Context(), raw)
	if err != nil {
		writeGoogleJSON(w, http.StatusBadRequest, map[string]any{"code": 10010001, "message": "invalid request"})
		return
	}
	var req telegramOidcRequest
	if err := json.Unmarshal(raw, &req); err != nil {
		writeGoogleJSON(w, http.StatusBadRequest, map[string]any{"code": 10010001, "message": "invalid request"})
		return
	}
	id, err := s.TelegramOidcLogin(r.Context(), req)
	if err != nil {
		status := http.StatusBadRequest
		code := 10010001
		if errors.Is(err, xerr.ErrCredentials) {
			status = http.StatusUnauthorized
			code = 10010003
		}
		writeGoogleJSON(w, status, map[string]any{"code": code, "message": xerr.Public(err).Error()})
		return
	}
	writeGoogleJSON(w, http.StatusOK, map[string]any{
		"code": "OK",
		"data": map[string]any{
			"uid":       id.UID,
			"sid":       id.SID,
			"expiresAt": id.ExpiresAt.Format(time.RFC3339Nano),
		},
	})
}
