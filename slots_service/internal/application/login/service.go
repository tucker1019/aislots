// Package login verifies a platform user before the transport establishes a game session.
package login

import (
	"aislots/slots_service/internal/platform"
	"context"
	"errors"
	"fmt"
)

var ErrVerification = errors.New("platform identity verification failed")

type Service struct{ platforms platform.Resolver }

func New(p platform.Resolver) (*Service, error) {
	if p == nil {
		return nil, fmt.Errorf("platform resolver required")
	}
	return &Service{p}, nil
}
func (s *Service) Verify(ctx context.Context, request platform.LoginRequest) (platform.VerifiedUser, error) {
	if !request.Subject.Valid() || request.Credential == "" {
		return platform.VerifiedUser{}, ErrVerification
	}
	c, err := s.platforms.Resolve(request.Subject.AppName, request.Subject.AppKey)
	if err != nil {
		return platform.VerifiedUser{}, err
	}
	u, err := c.VerifyUser(ctx, request)
	if err != nil {
		return platform.VerifiedUser{}, err
	}
	if !u.Context.Valid() || u.Context.Subject != request.Subject {
		return platform.VerifiedUser{}, ErrVerification
	}
	return u, nil
}
