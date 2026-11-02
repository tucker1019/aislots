package repository

import (
	"context"
	"time"

	"apps/app/apis/lobby/api/internal/repository/model"
)

//go:generate go run go.uber.org/mock/mockgen -source=repository_type.go -destination=mocks/mock_users.go -package=mocks
type UserStore interface {
	Profile(context.Context, int64, string, time.Time) (*model.Profile, error)
	UpdateProfile(context.Context, int64, string, time.Time, *string, *int32) (*model.Profile, error)
	Create(context.Context, string, string, string, time.Time) (int64, error)
	Check(context.Context, int64, string, time.Time) error
	Renew(context.Context, int64, string, time.Time, time.Time) error
	Credentials(context.Context, string) (int64, string, error)
	NewSession(context.Context, int64, string, time.Time) error
	Bind(context.Context, int64, string, string, string, time.Time, time.Time) error
}
