package repository

import (
	"context"
	"time"

	"apps/app/apis/lobby/api/internal/repository/model"
)

//go:generate go run go.uber.org/mock/mockgen -source=newbie_type.go -destination=mocks/mock_newbie.go -package=mocks
type NewbieStore interface {
	ReadNewbie(context.Context, int64, string, time.Time) (*model.NewbieView, error)
	ClaimNewbie(context.Context, int64, string, string, time.Time) (*model.NewbieReceipt, error)
}
