package userservice

import (
	"context"
	"testing"

	"apps/pkg/xerr"

	"go.uber.org/mock/gomock"
)

func TestGoogleLoginCreatesThenSignsInExistingAccount(t *testing.T) {
	svc, store := setup(t)
	verifier := func(ctx context.Context, idToken string) (GoogleTokenClaims, error) {
		if idToken != "valid-google-token" {
			return GoogleTokenClaims{}, xerr.ErrCredentials
		}
		return GoogleTokenClaims{
			Sub:           "109876543210",
			Aud:           "test-client-id.apps.googleusercontent.com",
			Email:         "player@example.com",
			EmailVerified: "true",
		}, nil
	}

	// First login: account does not exist yet -> Create
	store.EXPECT().Credentials(gomock.Any(), "player@example.com").Return(int64(0), "", xerr.ErrCredentials)
	store.EXPECT().Create(gomock.Any(), "player@example.com", gomock.Any(), gomock.Any(), gomock.Any()).Return(int64(101), nil)

	first, err := svc.googleLoginWithVerifier(
		context.Background(),
		"valid-google-token",
		"",
		[]string{"test-client-id.apps.googleusercontent.com"},
		verifier,
	)
	if err != nil {
		t.Fatalf("first Google login failed: %v", err)
	}
	if first.UID != 101 || len(first.SID) != 52 {
		t.Fatalf("unexpected first identity: %+v", first)
	}

	// Second login: account already exists -> NewSession
	store.EXPECT().Credentials(gomock.Any(), "player@example.com").Return(int64(101), "hashed", nil)
	store.EXPECT().NewSession(gomock.Any(), int64(101), gomock.Any(), gomock.Any()).Return(nil)

	second, err := svc.googleLoginWithVerifier(
		context.Background(),
		"valid-google-token",
		"",
		[]string{"test-client-id.apps.googleusercontent.com"},
		verifier,
	)
	if err != nil {
		t.Fatalf("second Google login failed: %v", err)
	}
	if second.UID != first.UID {
		t.Fatalf("expected same uid %d, got %d", first.UID, second.UID)
	}
	if second.SID == first.SID {
		t.Fatalf("expected new session sid on second login")
	}

	// Audience mismatch -> ErrCredentials
	if _, err := svc.googleLoginWithVerifier(
		context.Background(),
		"valid-google-token",
		"",
		[]string{"other-client-id"},
		verifier,
	); err != xerr.ErrCredentials {
		t.Fatalf("expected ErrCredentials on aud mismatch, got %v", err)
	}
}
