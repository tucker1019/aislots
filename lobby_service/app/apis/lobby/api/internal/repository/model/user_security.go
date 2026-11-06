package model

import (
	"apps/pkg/xerr"
	"context"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"time"
)

// ChangePassword validates the old credential under the user lock and revokes
// every session in the same transaction, including the session making this request.
func (m *UserModel) ChangePassword(ctx context.Context, uid int64, sidHash, oldPassword, newHash string, now time.Time) error {
	return m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var user LobbyUser
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid=?", uid).Take(&user).Error; err != nil {
			return xerr.ErrSession
		}
		var sessions int64
		if err := tx.Model(&LobbySession{}).Where("uid=? AND sid_hash=? AND expires_at>?", uid, sidHash, now).Count(&sessions).Error; err != nil {
			return err
		}
		if sessions == 0 {
			return xerr.ErrSession
		}
		if user.PasswordHash == nil || bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(oldPassword)) != nil {
			return xerr.ErrCredentials
		}
		if err := tx.Model(&LobbyUser{}).Where("uid=?", uid).Update("password_hash", newHash).Error; err != nil {
			return err
		}
		return tx.Where("uid=?", uid).Delete(&LobbySession{}).Error
	})
}
func (m *UserModel) Logout(ctx context.Context, uid int64, sidHash string) error {
	// Already removed is also successful: safe to retry if the response was lost.
	return m.DB.WithContext(ctx).Where("uid=? AND sid_hash=?", uid, sidHash).Delete(&LobbySession{}).Error
}

// Reject a login that verified the old hash just before a concurrent password change.
func (m *UserModel) NewPasswordSession(ctx context.Context, uid int64, expectedHash, token string, expiry time.Time) error {
	return m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var user LobbyUser
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid=?", uid).Take(&user).Error; err != nil {
			return err
		}
		if user.PasswordHash == nil || *user.PasswordHash != expectedHash {
			return xerr.ErrCredentials
		}
		return tx.Create(&LobbySession{UID: uid, SidHash: token, ExpiresAt: expiry}).Error
	})
}
