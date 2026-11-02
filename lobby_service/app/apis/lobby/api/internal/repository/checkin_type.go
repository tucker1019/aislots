package repository

import (
	"context"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/model"
)

//go:generate go run go.uber.org/mock/mockgen -source=checkin_type.go -destination=mocks/mock_checkin.go -package=mocks
type CheckinStore interface {
	ReadCheckin(context.Context, int64, string, config.CheckinConfig, time.Time) (*model.CheckinState, error)
	ClaimCheckin(context.Context, int64, string, string, config.CheckinConfig, time.Time) (*model.LobbyCheckinClaim, error)
}
