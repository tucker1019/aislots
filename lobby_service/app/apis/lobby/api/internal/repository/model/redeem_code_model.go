package model

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base32"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"apps/pkg/coinsource"
	"apps/pkg/xerr"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type RedeemCode struct {
	ID                 string     `gorm:"column:id;primaryKey"`
	CodeHash           string     `gorm:"column:code_hash"`
	UID                int64      `gorm:"column:uid"`
	Amount             int64      `gorm:"column:amount"`
	TurnoverMultiplier int64      `gorm:"column:turnover_multiplier"`
	CreatedBy          string     `gorm:"column:created_by"`
	CreatedAt          time.Time  `gorm:"column:created_at"`
	RedeemedAt         *time.Time `gorm:"column:redeemed_at"`
	ClaimID            *string    `gorm:"column:claim_id"`
}

func (*RedeemCode) TableName() string { return "lobby_redeem_codes" }

type RedeemReceipt struct{ Amount, Coins int64 }

type RedeemCodeModel struct{ DB *gorm.DB }

func redeemCodeHash(code string) string {
	value := strings.ToUpper(strings.TrimSpace(code))
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func (m *RedeemCodeModel) Create(ctx context.Context, uid, amount int64, turnover bool, actor, reason string) (string, *RedeemCode, error) {
	if uid < 1 || amount < 1 || strings.TrimSpace(actor) == "" || strings.TrimSpace(reason) == "" {
		return "", nil, xerr.ErrInvalid
	}
	var random [16]byte
	if _, err := rand.Read(random[:]); err != nil {
		return "", nil, err
	}
	code := "RC-" + base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(random[:])
	var idBytes [12]byte
	if _, err := rand.Read(idBytes[:]); err != nil {
		return "", nil, err
	}
	id := "rc_" + hex.EncodeToString(idBytes[:])
	multiplier := int64(0)
	if turnover {
		multiplier = 1
	}
	row := &RedeemCode{ID: id, CodeHash: redeemCodeHash(code), UID: uid, Amount: amount, TurnoverMultiplier: multiplier, CreatedBy: actor, CreatedAt: time.Now().UTC()}
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var users int64
		if err := tx.Model(&LobbyUser{}).Where("uid = ?", uid).Count(&users).Error; err != nil {
			return err
		}
		if users != 1 {
			return gorm.ErrRecordNotFound
		}
		if err := tx.Create(row).Error; err != nil {
			return err
		}
		return InsertAdminAudit(tx, actor, "redeem-code.create", id, fmt.Sprintf("UID %d, amount %d, turnover %t. %s", uid, amount, turnover, reason))
	})
	return code, row, err
}

func (m *RedeemCodeModel) Redeem(ctx context.Context, uid int64, token, rawCode string, now time.Time) (*RedeemReceipt, error) {
	code := strings.ToUpper(strings.TrimSpace(rawCode))
	if uid < 1 || len(code) < 8 || len(code) > 64 {
		return nil, xerr.ErrRedeemCode
	}
	var receipt RedeemReceipt
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := (&UserModel{DB: tx}).Check(ctx, uid, token, now); err != nil {
			return err
		}
		var wallet LobbyWalletBalance
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid = ?", uid).Take(&wallet).Error; err != nil {
			return err
		}
		var record RedeemCode
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("code_hash = ?", redeemCodeHash(code)).Take(&record).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return xerr.ErrRedeemCode
		}
		if err != nil {
			return err
		}
		if record.UID != uid {
			return xerr.ErrRedeemCode
		}
		if record.RedeemedAt != nil && record.ClaimID != nil {
			var entry LobbyCoinLedger
			if err := tx.Where("uid = ? AND order_id = ? AND source = ?", uid, *record.ClaimID, string(coinsource.SourceRedeemCodeReward)).Take(&entry).Error; err != nil {
				return err
			}
			receipt = RedeemReceipt{Amount: record.Amount, Coins: entry.BalanceAfter}
			return nil
		}
		if wallet.Coins > math.MaxInt64-record.Amount {
			return xerr.ErrBalanceLimit
		}
		claimID := record.ID
		record.ClaimID = &claimID
		record.RedeemedAt = &now
		if err := tx.Model(&record).Updates(map[string]any{"claim_id": claimID, "redeemed_at": now}).Error; err != nil {
			return err
		}
		receipt = RedeemReceipt{Amount: record.Amount, Coins: wallet.Coins + record.Amount}
		entry := LobbyCoinLedger{UID: uid, OrderID: claimID, Source: string(coinsource.SourceRedeemCodeReward), Delta: record.Amount, BalanceBefore: wallet.Coins, BalanceAfter: receipt.Coins}
		if err := tx.Create(&entry).Error; err != nil {
			return err
		}
		return tx.Model(&wallet).Update("coins", receipt.Coins).Error
	})
	if err != nil {
		return nil, err
	}
	return &receipt, nil
}

type RedeemCodeListRow struct {
	ID         string     `json:"id"`
	UID        int64      `json:"uid"`
	Amount     int64      `json:"amount"`
	Turnover   bool       `json:"turnover"`
	Status     string     `json:"status"`
	CreatedBy  string     `json:"createdBy"`
	CreatedAt  time.Time  `json:"createdAt"`
	RedeemedAt *time.Time `json:"redeemedAt"`
}

func (m *RedeemCodeModel) List(ctx context.Context, q string, before time.Time, beforeID string, limit int) ([]RedeemCodeListRow, error) {
	var rows []RedeemCodeListRow
	query := m.DB.WithContext(ctx).Table("lobby_redeem_codes").Select("id,uid,amount,(turnover_multiplier > 0) turnover,CASE WHEN redeemed_at IS NULL THEN 'unused' ELSE 'redeemed' END status,created_by,created_at,redeemed_at")
	if q != "" {
		query = query.Where("uid::text = ? OR id = ?", q, q)
	}
	if !before.IsZero() {
		query = query.Where("(created_at,id) < (?,?)", before, beforeID)
	}
	err := query.Order("created_at DESC,id DESC").Limit(limit + 1).Scan(&rows).Error
	return rows, err
}
