package userservice

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"testing"
	"time"

	"apps/pkg/xerr"

	"go.uber.org/mock/gomock"
)

func signTelegramForTest(botToken string, authDate int64, id int64, firstName, username string) string {
	dataCheck := fmt.Sprintf("auth_date=%d\nfirst_name=%s\nid=%d\nusername=%s", authDate, firstName, id, username)
	secret := sha256.Sum256([]byte(botToken))
	mac := hmac.New(sha256.New, secret[:])
	_, _ = mac.Write([]byte(dataCheck))
	return hex.EncodeToString(mac.Sum(nil))
}

func TestTelegramLoginVerifiesSignatureAndSignsIn(t *testing.T) {
	svc, store := setup(t)
	now := time.Unix(1700000000, 0).UTC()
	botToken := "123456:test-bot-token"
	hash := signTelegramForTest(botToken, now.Unix()-10, 888999, "Tucker", "ttkk_user")

	payload := TelegramAuthPayload{
		ID:        888999,
		FirstName: "Tucker",
		Username:  "ttkk_user",
		AuthDate:  now.Unix() - 10,
		Hash:      hash,
	}

	store.EXPECT().Credentials(gomock.Any(), "@ttkk_user").Return(int64(0), "", xerr.ErrCredentials)
	store.EXPECT().Create(gomock.Any(), "@ttkk_user", gomock.Any(), gomock.Any(), gomock.Any()).Return(int64(202), nil)

	first, err := svc.telegramLoginWithToken(context.Background(), payload, botToken, now)
	if err != nil {
		t.Fatalf("first Telegram login failed: %v", err)
	}
	if first.UID != 202 || len(first.SID) != 52 {
		t.Fatalf("unexpected identity: %+v", first)
	}

	// Tampered hash must fail
	bad := payload
	bad.Hash = "0000000000000000000000000000000000000000000000000000000000000000"
	if _, err := svc.telegramLoginWithToken(context.Background(), bad, botToken, now); err != xerr.ErrCredentials {
		t.Fatalf("expected ErrCredentials for bad hash, got %v", err)
	}
}
