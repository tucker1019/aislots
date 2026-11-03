package model

import (
	"context"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type WalletAccountModel struct{ DB *gorm.DB }

func (m *WalletAccountModel) Accounts(ctx context.Context, uid int64) ([]*LobbyPayoutAccount, error) {
	var rows []*LobbyPayoutAccount
	err := m.DB.WithContext(ctx).Where("uid = ?", uid).Order("channel").Find(&rows).Error
	return rows, databaseError(err)
}

func (m *WalletAccountModel) SaveAccount(ctx context.Context, uid int64, channel, account, name string) error {
	row := LobbyPayoutAccount{UID: uid, Channel: channel, Account: account, Name: name, UpdatedAt: time.Now().UTC()}
	return databaseError(m.DB.WithContext(ctx).Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "uid"}, {Name: "channel"}}, DoUpdates: clause.AssignmentColumns([]string{"account", "name", "updated_at"})}).Create(&row).Error)
}
