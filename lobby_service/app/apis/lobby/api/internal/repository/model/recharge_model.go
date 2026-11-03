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

type RechargeModel struct {
	DB               *gorm.DB
	ActivityLocation *time.Location
	VIP              *VIPModel
}

func (m *RechargeModel) CreateRecharge(ctx context.Context, uid int64, token, requestID, tierID string, tier *config.RechargeTier, now time.Time) (*LobbyRechargeOrder, error) {
	var order LobbyRechargeOrder
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := (&UserModel{DB: tx}).Check(ctx, uid, token, now); err != nil {
			return err
		}
		// Serialize all mutations for a wallet, including duplicate request lookup.
		var wallet LobbyWalletBalance
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid = ?", uid).Take(&wallet).Error; err != nil {
			return err
		}
		err := tx.Where("uid = ? AND request_id = ?", uid, requestID).Take(&order).Error
		if err == nil {
			if order.TierID != tierID {
				return xerr.ErrRequestConflict
			}
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if tier == nil {
			return xerr.ErrRechargeTier
		}
		order = LobbyRechargeOrder{OrderID: rand.Text(), UID: uid, RequestID: requestID, TierID: tierID, Amount: tier.Amount, Bonus: tier.Bonus, Fee: tier.Fee, CreditAmount: tier.CreditAmount(), Status: "pending", PaymentURL: "https://www.baidu.com", CreatedAt: now, SettleAt: now.Add(3 * time.Second)}
		return tx.Create(&order).Error
	})
	if err != nil {
		var business *xerr.Error
		if errors.As(err, &business) {
			return nil, business
		}
		return nil, databaseError(err)
	}
	return &order, nil
}

// postRecharge is the wallet posting boundary: all entries and balance commit atomically.
func postRecharge(tx *gorm.DB, wallet *LobbyWalletBalance, order *LobbyRechargeOrder) error {
	entries := []LobbyCoinLedger{}
	balance := wallet.Coins
	add := func(source coinsource.Source, delta int64) {
		entries = append(entries, LobbyCoinLedger{UID: wallet.UID, OrderID: order.OrderID, Source: string(source), Delta: delta, BalanceBefore: balance, BalanceAfter: balance + delta})
		balance += delta
	}
	add(coinsource.SourceRechargeCredit, order.Amount)
	if order.Bonus > 0 {
		add(coinsource.SourceRechargeBonus, order.Bonus)
	}
	if order.Fee > 0 {
		add(coinsource.SourceRechargeFee, -order.Fee)
	}
	if err := tx.Create(&entries).Error; err != nil {
		return err
	}
	return tx.Model(wallet).Update("coins", balance).Error
}

// OrderQuery uses a stable (created_at, order_id) cursor, newest first.
type OrderQuery struct {
	From, To   time.Time
	Status     string
	Limit      int
	BeforeTime time.Time
	BeforeID   string
}

func (m *RechargeModel) ReadRechargeOrder(ctx context.Context, uid int64, token, id string, now time.Time) (*LobbyRechargeOrder, error) {
	if err := (&UserModel{DB: m.DB}).Check(ctx, uid, token, now); err != nil {
		return nil, err
	}
	var order LobbyRechargeOrder
	err := m.DB.WithContext(ctx).Where("uid = ? AND order_id = ?", uid, id).Take(&order).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, xerr.ErrOrderNotFound
	}
	if err != nil {
		return nil, databaseError(err)
	}
	return &order, nil
}

func (m *RechargeModel) ReadRechargeOrders(ctx context.Context, uid int64, token string, q OrderQuery, now time.Time) ([]*LobbyRechargeOrder, error) {
	if err := (&UserModel{DB: m.DB}).Check(ctx, uid, token, now); err != nil {
		return nil, err
	}
	query := m.DB.WithContext(ctx).Where("uid = ?", uid)
	if !q.From.IsZero() {
		query = query.Where("created_at >= ?", q.From)
	}
	if !q.To.IsZero() {
		query = query.Where("created_at < ?", q.To)
	}
	if q.Status != "" {
		query = query.Where("status = ?", q.Status)
	}
	if !q.BeforeTime.IsZero() {
		query = query.Where("(created_at, order_id) < (?, ?)", q.BeforeTime, q.BeforeID)
	}
	var orders []*LobbyRechargeOrder
	err := query.Order("created_at DESC, order_id DESC").Limit(q.Limit + 1).Find(&orders).Error
	if err != nil {
		return nil, databaseError(err)
	}
	return orders, nil
}

// SettleDue claims durable orders. Wallet, source ledger and terminal status share one transaction.
func (m *RechargeModel) SettleDue(ctx context.Context, now time.Time) error {
	for i := 0; i < 25; i++ {
		found := false
		err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			var order LobbyRechargeOrder
			err := tx.Clauses(clause.Locking{Strength: "UPDATE", Options: "SKIP LOCKED"}).Where("status = ? AND settle_at <= ?", "pending", now).Order("settle_at, order_id").Take(&order).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			if err != nil {
				return err
			}
			found = true
			var wallet LobbyWalletBalance
			if err = tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid = ?", order.UID).Take(&wallet).Error; err != nil {
				return err
			}
			updates := map[string]any{"settled_at": now, "status": "success"}
			if wallet.Coins > math.MaxInt64-order.Amount-order.Bonus {
				updates["status"] = "failed"
				updates["failure_code"] = xerr.ErrBalanceLimit.Code.Number()
			} else {
				updates["coins"] = wallet.Coins + order.CreditAmount
				if err = postRecharge(tx, &wallet, &order); err != nil {
					return err
				}
				if err = recordActivity(tx, &LobbyActivityEvent{EventID: "recharge:" + order.OrderID, UID: order.UID, EventType: EventRechargeSuccess, Amount: order.Amount, OccurredAt: now.UTC().Truncate(time.Microsecond), BusinessDate: activityDate(now, m.ActivityLocation)}, m.VIP); err != nil {
					return err
				}
			}
			return tx.Model(&order).Updates(updates).Error
		})
		if err != nil {
			return databaseError(err)
		}
		if !found {
			return nil
		}
	}
	return nil
}
