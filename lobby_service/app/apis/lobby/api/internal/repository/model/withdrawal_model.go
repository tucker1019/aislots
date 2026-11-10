package model

import (
	"context"
	"crypto/rand"
	"errors"
	"math"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/pkg/coinsource"
	"apps/pkg/xerr"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type WithdrawalModel struct{ DB *gorm.DB }

func (m *WithdrawalModel) Create(ctx context.Context, uid int64, token, requestID, channel, tierID string, tier *config.RechargeTier) (*LobbyWithdrawalOrder, error) {
	var out LobbyWithdrawalOrder
	e := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if e := (&UserModel{DB: tx}).Check(ctx, uid, token, time.Now()); e != nil {
			return e
		}
		var wallet LobbyWalletBalance
		if e := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid=?", uid).Take(&wallet).Error; e != nil {
			return e
		}
		e := tx.Where("uid=? AND request_id=?", uid, requestID).Take(&out).Error
		if e == nil {
			if out.Channel != channel || out.TierID != tierID {
				return xerr.ErrWithdrawalConflict
			}
			return nil
		}
		if !errors.Is(e, gorm.ErrRecordNotFound) {
			return e
		}
		// Existing request receipts are returned before checking newly added requirements.
		left, err := (&TurnoverModel{DB: tx}).Remaining(ctx, uid)
		if err != nil {
			return err
		}
		if left > 0 {
			items, err := (&TurnoverModel{DB: tx}).activeItems(ctx, uid, left)
			if err != nil {
				return err
			}
			return xerr.WithdrawalTurnover(left, items)
		}
		if tier == nil {
			return xerr.ErrInvalid
		}
		var account LobbyPayoutAccount
		if e := tx.Where("uid=? AND channel=?", uid, channel).Take(&account).Error; e != nil {
			if errors.Is(e, gorm.ErrRecordNotFound) {
				return xerr.ErrWithdrawalAccount
			}
			return e
		}
		if wallet.Coins < tier.Amount {
			return xerr.ErrWithdrawalFunds
		}
		out = LobbyWithdrawalOrder{OrderID: "wdr_" + rand.Text(), UID: uid, RequestID: requestID, TierID: tierID, Channel: channel, Account: account.Account, Name: account.Name, Amount: tier.Amount, Fee: tier.Fee, Bonus: tier.Bonus, Status: "pending", CreatedAt: time.Now().UTC()}
		if e := tx.Create(&out).Error; e != nil {
			return e
		}
		return withdrawalPost(tx, &wallet, out.OrderID, coinsource.SourceWithdrawalDebit, -out.Amount)
	})
	return &out, withdrawalError(e)
}

func withdrawalError(e error) error {
	var b *xerr.Error
	if errors.As(e, &b) {
		return b
	}
	return databaseError(e)
}

func withdrawalPost(tx *gorm.DB, w *LobbyWalletBalance, id string, source coinsource.Source, delta int64) error {
	if delta > 0 && w.Coins > math.MaxInt64-delta {
		return xerr.ErrBalanceLimit
	}
	row := LobbyCoinLedger{UID: w.UID, OrderID: id, Source: string(source), Delta: delta, BalanceBefore: w.Coins, BalanceAfter: w.Coins + delta, CreatedAt: time.Now().UTC()}
	if e := tx.Create(&row).Error; e != nil {
		return e
	}
	return tx.Model(w).Update("coins", row.BalanceAfter).Error
}

func (m *WithdrawalModel) Review(ctx context.Context, uid int64, token, id, decision string) (*LobbyWithdrawalOrder, error) {
	if decision != "approve" && decision != "return" {
		return nil, xerr.ErrInvalid
	}
	var out LobbyWithdrawalOrder
	e := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if e := (&UserModel{DB: tx}).Check(ctx, uid, token, time.Now()); e != nil {
			return e
		}
		var wallet LobbyWalletBalance
		if e := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid=?", uid).Take(&wallet).Error; e != nil {
			return e
		}
		e := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid=? AND order_id=?", uid, id).Take(&out).Error
		if errors.Is(e, gorm.ErrRecordNotFound) {
			return xerr.ErrWithdrawalNotFound
		}
		if e != nil {
			return e
		}
		status := "success"
		if decision == "return" {
			status = "failed"
		}
		if out.Status != "pending" {
			if out.Status != status {
				return xerr.ErrWithdrawalConflict
			}
			return nil
		}
		if decision == "return" {
			e = withdrawalPost(tx, &wallet, id, coinsource.SourceWithdrawalRefund, out.Amount)
		} else if out.Bonus > 0 {
			e = withdrawalPost(tx, &wallet, id, coinsource.SourceWithdrawalBonus, out.Bonus)
		}
		if e != nil {
			return e
		}
		now := time.Now().UTC()
		out.Status = status
		out.SettledAt = &now
		return tx.Model(&out).Updates(map[string]interface{}{"status": status, "settled_at": now}).Error
	})
	return &out, withdrawalError(e)
}

func (m *WithdrawalModel) Info(ctx context.Context, uid int64, id string) (*LobbyWithdrawalOrder, error) {
	var row LobbyWithdrawalOrder
	e := m.DB.WithContext(ctx).Where("uid=? AND order_id=?", uid, id).Take(&row).Error
	if errors.Is(e, gorm.ErrRecordNotFound) {
		return nil, xerr.ErrWithdrawalNotFound
	}
	return &row, withdrawalError(e)
}

type CashOrderRow struct {
	OrderID, Kind, Status, Channel, Account, Name, PaymentURL, TierID, RequestID string
	Amount, Fee, Bonus, CreditAmount                                             int64
	CreatedAt                                                                    time.Time
	SettledAt                                                                    *time.Time
}

func (m *WithdrawalModel) CashOrders(ctx context.Context, uid int64, kind string, from, to time.Time, beforeTime time.Time, beforeID string) ([]CashOrderRow, error) {
	sql := `(SELECT order_id,'deposit' AS kind,status,'' AS channel,'' AS account,'' AS name,payment_url,tier_id,request_id,amount,fee,bonus,credit_amount,created_at,settled_at FROM lobby_recharge_orders WHERE uid=?
 UNION ALL SELECT order_id,'withdrawal' AS kind,status,channel,account,name,'' AS payment_url,tier_id,request_id,amount,fee,bonus,amount-fee AS credit_amount,created_at,settled_at FROM lobby_withdrawal_orders WHERE uid=?) AS orders`
	q := m.DB.WithContext(ctx).Table(sql, uid, uid).Where("created_at>=? AND created_at<?", from, to)
	if kind != "all" {
		q = q.Where("kind=?", kind)
	}
	if !beforeTime.IsZero() {
		q = q.Where("(created_at,order_id)<(?,?)", beforeTime, beforeID)
	}
	var rows []CashOrderRow
	e := q.Order("created_at DESC,order_id DESC").Limit(21).Scan(&rows).Error
	return rows, databaseError(e)
}
