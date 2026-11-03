package repository

import (
	"context"

	"apps/app/apis/lobby/api/internal/repository/model"
)

type WalletStore interface {
	Accounts(context.Context, int64) ([]*model.LobbyPayoutAccount, error)
	SaveAccount(context.Context, int64, string, string, string) error
}
