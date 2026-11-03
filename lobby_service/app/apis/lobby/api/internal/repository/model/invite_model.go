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

type InviteModel struct {
	DB     *gorm.DB
	Config config.InviteConfig
}
type InviteView struct {
	Code                                                       string
	InvitedCount, QualifiedCount, PendingAmount, ClaimedAmount int64
}

// bind is called only inside the new visitor transaction, never on login/renewal/binding an account.
func (m *InviteModel) bind(tx *gorm.DB, uid int64, code string, created time.Time) error {
	if code == "" || len(code) > 64 {
		return nil
	}
	var owner LobbyInviteCode
	err := tx.Where("code = ?", code).Take(&owner).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if owner.UID == uid {
		return nil
	}
	c := m.Config
	return tx.Create(&LobbyInviteRelation{InviteeUID: uid, InviterUID: owner.UID, RegisteredAt: created, Deadline: created.Add(time.Duration(c.DurationDays) * 24 * time.Hour), ConfigVersion: c.Version, MinDepositCount: c.MinDepositCount, MinDepositAmount: c.MinDepositAmount, MinBetAmount: c.MinBetAmount, RewardAmount: c.RewardAmount}).Error
}

func (m *InviteModel) materialize(tx *gorm.DB, uid int64, now time.Time) error {
	return tx.Exec(`INSERT INTO lobby_invite_rewards(invitee_uid,inviter_uid,amount,earned_at,slot)
 SELECT r.invitee_uid,r.inviter_uid,r.reward_amount,?, COALESCE((SELECT MAX(slot) FROM lobby_invite_rewards WHERE inviter_uid=?),0)+ROW_NUMBER() OVER(ORDER BY r.invitee_uid) FROM lobby_invite_relations r
 WHERE r.inviter_uid=? AND NOT EXISTS(SELECT 1 FROM lobby_invite_rewards w WHERE w.invitee_uid=r.invitee_uid)
 AND EXISTS(SELECT 1 FROM lobby_payout_accounts a WHERE a.uid=r.invitee_uid AND a.created_at<r.deadline AND a.created_at<=?)
 AND (SELECT count(*) FROM lobby_recharge_orders o WHERE o.uid=r.invitee_uid AND o.status='success' AND COALESCE(o.settled_at,o.created_at)>=r.registered_at AND COALESCE(o.settled_at,o.created_at)<r.deadline AND COALESCE(o.settled_at,o.created_at)<=?)>=r.min_deposit_count
 AND (SELECT COALESCE(sum(o.amount),0) FROM lobby_recharge_orders o WHERE o.uid=r.invitee_uid AND o.status='success' AND COALESCE(o.settled_at,o.created_at)>=r.registered_at AND COALESCE(o.settled_at,o.created_at)<r.deadline AND COALESCE(o.settled_at,o.created_at)<=?)>=r.min_deposit_amount
 AND (SELECT COALESCE(sum(e.amount),0) FROM lobby_activity_events e WHERE e.uid=r.invitee_uid AND e.event_type='game_bet' AND e.occurred_at>=r.registered_at AND e.occurred_at<r.deadline AND e.occurred_at<=?)>=r.min_bet_amount
 ON CONFLICT(invitee_uid) DO NOTHING`, now, uid, uid, now, now, now, now).Error
}

func (m *InviteModel) Read(ctx context.Context, uid int64, now time.Time) (*InviteView, error) {
	v := &InviteView{}
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var wallet LobbyWalletBalance
		if e := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid = ?", uid).Take(&wallet).Error; e != nil {
			return e
		}
		code := LobbyInviteCode{UID: uid, Code: rand.Text()}
		if e := tx.Clauses(clause.OnConflict{Columns: []clause.Column{{Name: "uid"}}, DoNothing: true}).Create(&code).Error; e != nil {
			return e
		}
		if e := tx.Where("uid = ?", uid).Take(&code).Error; e != nil {
			return e
		}
		v.Code = code.Code
		if e := m.materialize(tx, uid, now); e != nil {
			return e
		}
		if e := tx.Model(&LobbyInviteRelation{}).Where("inviter_uid = ?", uid).Count(&v.InvitedCount).Error; e != nil {
			return e
		}
		var totals struct{ QualifiedCount, PendingAmount, ClaimedAmount int64 }
		err := tx.Model(&LobbyInviteReward{}).Select("COUNT(*) AS qualified_count, COALESCE(SUM(CASE WHEN batch_id IS NULL THEN amount ELSE 0 END),0) AS pending_amount, COALESCE(SUM(CASE WHEN batch_id IS NOT NULL THEN amount ELSE 0 END),0) AS claimed_amount").Where("inviter_uid = ?", uid).Scan(&totals).Error
		v.QualifiedCount = totals.QualifiedCount
		v.PendingAmount = totals.PendingAmount
		v.ClaimedAmount = totals.ClaimedAmount
		return err
	})
	return v, err
}

func (m *InviteModel) Claim(ctx context.Context, uid int64, requestID string, now time.Time) (*LobbyInviteBatch, error) {
	return m.claim(ctx, uid, requestID, now, 0)
}

func (m *InviteModel) ClaimOne(ctx context.Context, uid int64, requestID string, now time.Time, target int64) (*LobbyInviteBatch, error) {
	if target <= 0 {
		return nil, xerr.ErrInvalid
	}
	return m.claim(ctx, uid, requestID, now, target)
}

func (m *InviteModel) claim(ctx context.Context, uid int64, requestID string, now time.Time, target int64) (*LobbyInviteBatch, error) {
	var batch LobbyInviteBatch
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var wallet LobbyWalletBalance
		if e := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid = ?", uid).Take(&wallet).Error; e != nil {
			return e
		}
		e := tx.Where("uid = ? AND request_id = ?", uid, requestID).Take(&batch).Error
		if e == nil {
			if target > 0 {
				var count int64
				if err := tx.Model(&LobbyInviteReward{}).Where("inviter_uid = ? AND invitee_uid = ? AND batch_id = ?", uid, target, batch.ClaimID).Count(&count).Error; err != nil {
					return err
				}
				if count != 1 {
					return xerr.ErrInvalid
				}
			}
			return nil
		}
		if !errors.Is(e, gorm.ErrRecordNotFound) {
			return e
		}
		if e = m.materialize(tx, uid, now); e != nil {
			return e
		}
		var total int64
		pending := func() *gorm.DB {
			q := tx.Model(&LobbyInviteReward{}).Where("inviter_uid = ? AND batch_id IS NULL", uid)
			if target > 0 {
				q = q.Where("invitee_uid = ?", target)
			}
			return q
		}
		if e = pending().Select("COALESCE(SUM(amount),0)").Scan(&total).Error; e != nil {
			return e
		}
		if total <= 0 {
			return xerr.ErrReturnEmpty
		}
		if wallet.Coins > math.MaxInt64-total {
			return xerr.ErrBalanceLimit
		}
		batch = LobbyInviteBatch{ClaimID: "inv_" + rand.Text(), UID: uid, RequestID: requestID, TotalReward: total, Coins: wallet.Coins + total, CreatedAt: now}
		if e = tx.Create(&batch).Error; e != nil {
			return e
		}
		if e = pending().Updates(map[string]any{"batch_id": batch.ClaimID, "claimed_at": now}).Error; e != nil {
			return e
		}
		if e = tx.Create(&LobbyCoinLedger{UID: uid, OrderID: batch.ClaimID, Source: string(coinsource.SourceInviteReward), Delta: total, BalanceBefore: wallet.Coins, BalanceAfter: batch.Coins, CreatedAt: now}).Error; e != nil {
			return e
		}
		return tx.Model(&wallet).Update("coins", batch.Coins).Error
	})
	return &batch, err
}
