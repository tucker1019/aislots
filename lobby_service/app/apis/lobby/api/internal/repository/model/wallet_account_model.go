package model

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type WalletAccountModel struct{ DB *gorm.DB }

func (m *WalletAccountModel) Accounts(ctx context.Context, uid int64) ([]*LobbyPayoutAccount, error) {
	var rows []*LobbyPayoutAccount
	err := m.DB.WithContext(ctx).Where("uid = ?", uid).Order("updated_at DESC, channel ASC").Find(&rows).Error
	if err != nil || len(rows) == 0 {
		return rows, databaseError(err)
	}
	// Include failed and pending payouts: the latest attempt remains the user's choice.
	var latest LobbyWithdrawalOrder
	err = m.DB.WithContext(ctx).Where("uid = ?", uid).Order("created_at DESC, order_id DESC").Take(&latest).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return rows, nil
	}
	if err != nil {
		return nil, databaseError(err)
	}
	for i, row := range rows {
		if row.Channel == latest.Channel && row.Account == latest.Account {
			preferred := rows[i]
			copy(rows[1:i+1], rows[:i])
			rows[0] = preferred
			break
		}
	}
	return rows, nil
}

func (m *WalletAccountModel) SaveAccount(ctx context.Context, uid int64, channel, account, name string) error {
	row := LobbyPayoutAccount{UID: uid, Channel: channel, Account: account, Name: name, UpdatedAt: time.Now().UTC()}
	return databaseError(m.DB.WithContext(ctx).Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "uid"}, {Name: "channel"}}, DoUpdates: clause.AssignmentColumns([]string{"account", "name", "updated_at"})}).Create(&row).Error)
}
