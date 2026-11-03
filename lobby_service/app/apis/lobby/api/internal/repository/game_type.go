package repository

import (
	"context"
	"time"

	"apps/app/apis/lobby/api/internal/repository/model"
)

type GameStore interface {
	Issue(context.Context, int64, string, string, string, time.Time) error
	Exchange(context.Context, string, string, string, time.Time) (int64, error)
	Balance(context.Context, int64) (int64, error)
	Settle(context.Context, *model.LobbyGameSettlement, time.Time) (*model.LobbyGameSettlement, error)
}
