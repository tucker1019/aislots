package model

import (
	"context"
	"crypto/rand"
	"errors"
	"math/big"
	"strconv"
	"time"

	codes "apps/pb/apis/lobby/api/errors"
	"apps/pkg/xerr"

	"github.com/jackc/pgx/v5/pgconn"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// UserModel contains custom transactional operations; generated models are never edited.
type UserModel struct {
	DB     *gorm.DB
	VIP    *VIPModel
	Newbie *NewbieModel
	Invite *InviteModel
}

func databaseError(err error) error {
	if err == nil {
		return nil
	}
	var unique *pgconn.PgError
	if errors.As(err, &unique) && unique.Code == "23505" {
		return xerr.ErrExists
	}
	return xerr.Wrap(err, codes.UserError_USER_ERROR_DATABASE, "数据库服务暂时不可用")
}

func (m *UserModel) Create(ctx context.Context, account, password, token string, expiry time.Time) (int64, error) {
	return m.create(ctx, account, password, token, expiry, "")
}
func (m *UserModel) CreateInvited(ctx context.Context, token string, expiry time.Time, code string) (int64, error) {
	return m.create(ctx, "", "", token, expiry, code)
}
func (m *UserModel) create(ctx context.Context, account, password, token string, expiry time.Time, code string) (int64, error) {
	avatar, err := rand.Int(rand.Reader, big.NewInt(15))
	if err != nil {
		return 0, xerr.Public(err)
	}
	user := LobbyUser{Nickname: "", AvatarID: int32(avatar.Int64() + 1)}
	if account != "" {
		user.Account = &account
		user.PasswordHash = &password
	}
	err = m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(&user).Error; err != nil {
			return err
		}
		if err := tx.Model(&user).Update("nickname", "player_"+strconv.FormatInt(user.UID, 10)).Error; err != nil {
			return err
		}
		if err := tx.Exec("INSERT INTO lobby_wallet_balances(uid) VALUES (?)", user.UID).Error; err != nil {
			return err
		}
		if m.VIP != nil {
			if _, err := m.VIP.ensureState(tx, user.UID, user.CreatedAt); err != nil {
				return err
			}
		}
		if m.Newbie != nil {
			if _, err := m.Newbie.enroll(tx, user.UID, user.CreatedAt); err != nil {
				return err
			}
		}
		if m.Invite != nil && code != "" {
			if err := m.Invite.bind(tx, user.UID, code, user.CreatedAt); err != nil {
				return err
			}
		}
		return tx.Create(&LobbySession{SidHash: token, UID: user.UID, ExpiresAt: expiry}).Error
	})
	return user.UID, databaseError(err)
}

func (m *UserModel) Check(ctx context.Context, uid int64, token string, now time.Time) error {
	var session LobbySession
	err := m.DB.WithContext(ctx).Where("uid = ? AND sid_hash = ? AND expires_at > ?", uid, token, now).Take(&session).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return xerr.ErrSession
	}
	return databaseError(err)
}

func (m *UserModel) Renew(ctx context.Context, uid int64, token string, now, expiry time.Time) error {
	result := m.DB.WithContext(ctx).Model(&LobbySession{}).Where("uid = ? AND sid_hash = ? AND expires_at > ?", uid, token, now).Update("expires_at", expiry)
	if result.Error != nil {
		return databaseError(result.Error)
	}
	if result.RowsAffected != 1 {
		return xerr.ErrSession
	}
	return nil
}

func (m *UserModel) Credentials(ctx context.Context, account string) (int64, string, error) {
	var user LobbyUser
	err := m.DB.WithContext(ctx).Where("account = ?", account).Take(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, "", xerr.ErrCredentials
	}
	if err != nil {
		return 0, "", databaseError(err)
	}
	if user.PasswordHash == nil {
		return 0, "", xerr.ErrCredentials
	}
	return user.UID, *user.PasswordHash, nil
}

func (m *UserModel) NewSession(ctx context.Context, uid int64, token string, expiry time.Time) error {
	return databaseError(m.DB.WithContext(ctx).Create(&LobbySession{UID: uid, SidHash: token, ExpiresAt: expiry}).Error)
}

func (m *UserModel) Bind(ctx context.Context, uid int64, token, account, password string, now, expiry time.Time) error {
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var session LobbySession
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid = ? AND sid_hash = ? AND expires_at > ?", uid, token, now).Take(&session).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return xerr.ErrSession
		}
		if err != nil {
			return err
		}
		result := tx.Model(&LobbyUser{}).Where("uid = ? AND account IS NULL", uid).Updates(map[string]any{"account": account, "password_hash": password})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return xerr.ErrExists
		}
		return tx.Model(&LobbySession{}).Where("sid_hash = ?", token).Update("expires_at", expiry).Error
	})
	var business *xerr.Error
	if errors.As(err, &business) {
		return business
	}
	return databaseError(err)
}

// Profile checks the session without extending its expiry.
func (m *UserModel) Profile(ctx context.Context, uid int64, token string, now time.Time) (*Profile, error) {
	if err := m.Check(ctx, uid, token, now); err != nil {
		return nil, err
	}
	var user Profile
	if err := profileQuery(m.DB.WithContext(ctx), uid).Take(&user).Error; err != nil {
		return nil, databaseError(err)
	}
	return &user, nil
}

// UpdateProfile writes only supplied fields and returns the committed profile.
func (m *UserModel) UpdateProfile(ctx context.Context, uid int64, token string, now time.Time, nickname *string, avatar *int32) (*Profile, error) {
	var user Profile
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var session LobbySession
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid = ? AND sid_hash = ? AND expires_at > ?", uid, token, now).Take(&session).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return xerr.ErrSession
		}
		if err != nil {
			return err
		}
		fields := map[string]any{}
		if nickname != nil {
			fields["nickname"] = *nickname
		}
		if avatar != nil {
			fields["avatar_id"] = *avatar
		}
		if err := tx.Model(&LobbyUser{}).Where("uid = ?", uid).Updates(fields).Error; err != nil {
			return err
		}
		return profileQuery(tx, uid).Take(&user).Error
	})
	var business *xerr.Error
	if errors.As(err, &business) {
		return nil, business
	}
	if err != nil {
		return nil, databaseError(err)
	}
	return &user, nil
}

// Profile is a read projection of user and wallet, never a writable balance model.
type Profile struct {
	UID      int64
	Nickname string
	AvatarID int32
	Coins    int64
}

func profileQuery(db *gorm.DB, uid int64) *gorm.DB {
	return db.Table("lobby_users AS u").Select("u.uid,u.nickname,u.avatar_id,w.coins").Joins("JOIN lobby_wallet_balances AS w ON w.uid = u.uid").Where("u.uid = ?", uid)
}
