package repository

import (
	"context"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/model"
)

//go:generate go run go.uber.org/mock/mockgen -source=return_type.go -destination=mocks/mock_return.go -package=mocks
type ReturnStore interface {
	ReadReturns(context.Context, int64, string, string, config.ReturnConfig, *time.Location, time.Time) (*model.ReturnView, error)
	ClaimReturns(context.Context, int64, string, string, string, config.ReturnConfig, *time.Location, time.Time) (*model.ReturnReceipt, error)
}
