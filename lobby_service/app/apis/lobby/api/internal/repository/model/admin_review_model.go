package model

import (
	"apps/pkg/coinsource"
	"context"
	"errors"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"math"
	"time"
)

var ErrAdminConflict = errors.New("review conflict")

func InsertAdminAudit(tx *gorm.DB, actor, action, target, reason string) error {
	return tx.Exec("INSERT INTO lobby_admin_audits(username,action,target,reason) VALUES(?,?,?,?)", actor, action, target, reason).Error
}

type AdminReview struct{ RequestID, Username, Kind, OrderID, Decision, Reason, Status string }

func (m *RechargeModel) AdminReview(ctx context.Context, v AdminReview) (string, error) {
	status := ""
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// A request lock serializes retries before acquiring business locks.
		if e := tx.Exec("SELECT pg_advisory_xact_lock(hashtextextended(?,0))", "admin-review:"+v.RequestID).Error; e != nil {
			return e
		}
		var old AdminReview
		e := tx.Table("lobby_admin_reviews").Where("request_id=?", v.RequestID).Take(&old).Error
		if e == nil {
			if old.Username != v.Username || old.Kind != v.Kind || old.OrderID != v.OrderID || old.Decision != v.Decision || old.Reason != v.Reason {
				return ErrAdminConflict
			}
			status = old.Status
			return nil
		}
		if !errors.Is(e, gorm.ErrRecordNotFound) {
			return e
		}
		now := time.Now().UTC()
		if v.Kind == "deposit" {
			var o LobbyRechargeOrder
			if e = tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("order_id=?", v.OrderID).Take(&o).Error; e != nil {
				return e
			}
			if o.Status != "pending" {
				return ErrAdminConflict
			}
			var w LobbyWalletBalance
			if e = tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid=?", o.UID).Take(&w).Error; e != nil {
				return e
			}
			settledBalance := w.Coins + o.CreditAmount
			status = "failed"
			if v.Decision == "approve" {
				if w.Coins > math.MaxInt64-o.Amount-o.Bonus {
					return ErrAdminConflict
				}
				if e = postRecharge(tx, &w, &o); e != nil {
					return e
				}
				if e = recordActivity(tx, &LobbyActivityEvent{EventID: "recharge:" + o.OrderID, UID: o.UID, EventType: EventRechargeSuccess, Amount: o.Amount, OccurredAt: now.Truncate(time.Microsecond), BusinessDate: activityDate(now, m.ActivityLocation)}, m.VIP); e != nil {
					return e
				}
				status = "success"
			}
			updates := map[string]any{"status": status, "settled_at": now}
			if status == "success" {
				updates["coins"] = settledBalance
			}
			res := tx.Model(&o).Where("status='pending'").Updates(updates)
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected != 1 {
				return ErrAdminConflict
			}
		} else {
			var o LobbyWithdrawalOrder
			if e = tx.Where("order_id=?", v.OrderID).Take(&o).Error; e != nil {
				return e
			}
			var w LobbyWalletBalance
			if e = tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid=?", o.UID).Take(&w).Error; e != nil {
				return e
			}
			if e = tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("order_id=?", v.OrderID).Take(&o).Error; e != nil {
				return e
			}
			if o.Status != "pending" {
				return ErrAdminConflict
			}
			status = "approved"
			if v.Decision == "return" {
				status = "failed"
				if e = withdrawalPost(tx, &w, o.OrderID, coinsource.SourceWithdrawalRefund, o.Amount); e != nil {
					return e
				}
			}
			updates := map[string]any{"status": status}
			if status == "failed" {
				updates["settled_at"] = now
			}
			res := tx.Model(&o).Where("status='pending'").Updates(updates)
			if res.Error != nil {
				return res.Error
			}
			if res.RowsAffected != 1 {
				return ErrAdminConflict
			}
		}
		v.Status = status
		if e = tx.Table("lobby_admin_reviews").Create(&v).Error; e != nil {
			return e
		}
		return InsertAdminAudit(tx, v.Username, "orders."+v.Decision, v.Kind+":"+v.OrderID, v.Reason)
	})
	return status, err
}
