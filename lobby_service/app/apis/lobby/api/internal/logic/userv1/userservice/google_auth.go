package userservice

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"apps/pkg/codec"
	"apps/pkg/xerr"
)

type GoogleTokenClaims struct {
	Sub           string `json:"sub"`
	Aud           string `json:"aud"`
	Email         string `json:"email"`
	EmailVerified string `json:"email_verified"`
	Name          string `json:"name"`
}

type GoogleTokenVerifier func(ctx context.Context, idToken string) (GoogleTokenClaims, error)

var defaultGoogleHTTPClient = &http.Client{Timeout: 8 * time.Second}

func VerifyGoogleIDToken(ctx context.Context, idToken string) (GoogleTokenClaims, error) {
	endpoint := "https://oauth2.googleapis.com/tokeninfo?id_token=" + url.QueryEscape(idToken)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return GoogleTokenClaims{}, err
	}
	resp, err := defaultGoogleHTTPClient.Do(req)
	if err != nil {
		return GoogleTokenClaims{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return GoogleTokenClaims{}, xerr.ErrCredentials
	}
	var claims GoogleTokenClaims
	if err := json.NewDecoder(io.LimitReader(resp.Body, 16384)).Decode(&claims); err != nil {
		return GoogleTokenClaims{}, xerr.ErrCredentials
	}
	if strings.TrimSpace(claims.Sub) == "" {
		return GoogleTokenClaims{}, xerr.ErrCredentials
	}
	return claims, nil
}

const defaultGoogleWebClientID = "7283855922-ovk6gd811v78tv5vp79j42m2e45keg9n.apps.googleusercontent.com"

func allowedGoogleClientIDs() []string {
	raw := strings.TrimSpace(os.Getenv("GOOGLE_WEB_CLIENT_ID"))
	if raw == "" {
		return []string{defaultGoogleWebClientID}
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if trimmed := strings.TrimSpace(p); trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func (s *Service) GoogleLogin(ctx context.Context, idToken, inviteCode string) (Identity, error) {
	return s.googleLoginWithVerifier(ctx, idToken, inviteCode, allowedGoogleClientIDs(), VerifyGoogleIDToken)
}

func (s *Service) googleLoginWithVerifier(
	ctx context.Context,
	idToken, inviteCode string,
	allowedClientIDs []string,
	verifier GoogleTokenVerifier,
) (Identity, error) {
	idToken = strings.TrimSpace(idToken)
	inviteCode = strings.TrimSpace(inviteCode)
	if idToken == "" || len(idToken) > 8192 {
		return Identity{}, xerr.ErrInvalid
	}
	if len(allowedClientIDs) == 0 {
		return Identity{}, xerr.ErrInvalid
	}
	claims, err := verifier(ctx, idToken)
	if err != nil || strings.TrimSpace(claims.Sub) == "" {
		return Identity{}, xerr.ErrCredentials
	}
	audMatched := false
	for _, cid := range allowedClientIDs {
		if claims.Aud == cid {
			audMatched = true
			break
		}
	}
	if !audMatched {
		return Identity{}, xerr.ErrCredentials
	}

	account := strings.ToLower(strings.TrimSpace(claims.Email))
	if len(account) < 3 || len(account) > 64 {
		account = "google:" + strings.TrimSpace(claims.Sub)
		if len(account) > 64 {
			account = account[:64]
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
	return s.Register(ctx, account, randomPassword, inviteCode)
}

type googleLoginRequest struct {
	IDToken    string `json:"idToken"`
	InviteCode string `json:"inviteCode"`
}

func (s *Service) GoogleLoginHTTP(w http.ResponseWriter, r *http.Request) {
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
	var req googleLoginRequest
	if err := json.Unmarshal(raw, &req); err != nil {
		writeGoogleJSON(w, http.StatusBadRequest, map[string]any{"code": 10010001, "message": "invalid request"})
		return
	}
	id, err := s.GoogleLogin(r.Context(), req.IDToken, req.InviteCode)
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

func writeGoogleJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
