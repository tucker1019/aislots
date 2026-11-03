package repository

import (
	"context"
	"time"

	"apps/app/apis/lobby/api/internal/repository/model"
)

//go:generate go run go.uber.org/mock/mockgen -source=vip_type.go -destination=mocks/mock_vip.go -package=mocks
type VIPStore interface {
	ReadVIP(context.Context, int64, string, time.Time) (*model.VIPView, error)
	ClaimVIP(context.Context, int64, string, string, string, string, string, time.Time) (*model.VIPReceipt, error)
	TickVIP(context.Context, time.Time) error
}
