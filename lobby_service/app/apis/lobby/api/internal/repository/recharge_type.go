package repository

import (
	"context"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/model"
)

//go:generate go run go.uber.org/mock/mockgen -source=recharge_type.go -destination=mocks/mock_recharge.go -package=mocks
type RechargeStore interface {
	CreateRecharge(context.Context, int64, string, string, string, *config.RechargeTier, time.Time) (*model.LobbyRechargeOrder, error)
	ReadRechargeOrder(context.Context, int64, string, string, time.Time) (*model.LobbyRechargeOrder, error)
	ReadRechargeOrders(context.Context, int64, string, model.OrderQuery, time.Time) ([]*model.LobbyRechargeOrder, error)
	SettleDue(context.Context, time.Time) error
}
