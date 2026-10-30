package login_test

import (
	"aislots/slots_service/internal/application/login"
	"aislots/slots_service/internal/domain/identity"
	adapters "aislots/slots_service/internal/infrastructure/platform"
	"aislots/slots_service/internal/platform"
	"context"
	"errors"
	"testing"
)

type client struct {
	wrong bool
	fail  bool
}

func (c client) VerifyUser(ctx context.Context, r platform.LoginRequest) (platform.VerifiedUser, error) {
	if c.fail {
		return platform.VerifiedUser{}, errors.New("platform unavailable")
	}
	subject := r.Subject
	if c.wrong {
		subject.AppKey = "other-app"
	}
	return platform.VerifiedUser{Context: identity.Context{Subject: subject, Country: "ID", Currency: "IDR"}}, nil
}
func (client) Transfer(context.Context, platform.Transfer) (platform.Receipt, error) {
	panic("login must not change money")
}
func (client) QueryTransfer(context.Context, platform.Transfer) (platform.Receipt, error) {
	panic("login must not query transfers")
}
func TestPlatformVerification(t *testing.T) {
	for _, wrong := range []bool{true, false} {
		registry, err := adapters.NewRegistry(map[adapters.App]platform.Client{{AppName: "a", AppKey: "app"}: client{wrong: wrong}})
		if err != nil {
			t.Fatal(err)
		}
		s, err := login.New(registry)
		if err != nil {
			t.Fatal(err)
		}
		r := platform.LoginRequest{Subject: identity.Subject{AppName: "a", AppKey: "app", UID: "u"}, Credential: "platform-login-ticket"}
		u, err := s.Verify(context.Background(), r)
		if wrong {
			if !errors.Is(err, login.ErrVerification) {
				t.Fatal("wrong app identity accepted", err)
			}
		} else if err != nil || u.Context.Subject != r.Subject || u.Context.Currency != "IDR" {
			t.Fatal(u, err)
		}
		r.Credential = ""
		if _, err = s.Verify(context.Background(), r); !errors.Is(err, login.ErrVerification) {
			t.Fatal("missing login credential accepted")
		}
	}
}
