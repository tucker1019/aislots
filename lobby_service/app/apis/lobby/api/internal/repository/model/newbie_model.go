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

type NewbieModel struct {
	DB     *gorm.DB
	Config config.NewbieConfig
}
type NewbieItem struct {
	Tier                LobbyNewbieRechargeTier
	Progress, Remaining int64
	Status              string
}
type NewbieView struct {
	Enrollment             *LobbyNewbieRecharge
	Amount, ClaimableTotal int64
	Items                  []*NewbieItem
}
type NewbieReceipt struct {
	Batch LobbyNewbieClaimBatch
	Items []*LobbyNewbieRechargeTier
}

// Registration fixes the deadline and per-user rules; existing accounts enroll from created_at.
func (m *NewbieModel) enroll(tx *gorm.DB, uid int64, now time.Time) (*LobbyNewbieRecharge, error) {
	var enrollment LobbyNewbieRecharge
	err := tx.Where("uid = ?", uid).Take(&enrollment).Error
	if err == nil {
		return &enrollment, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	var user LobbyUser
	if err = tx.Where("uid = ?", uid).Take(&user).Error; err != nil {
		return nil, err
	}
	enrollment = LobbyNewbieRecharge{UID: uid, StartsAt: user.CreatedAt, EnrolledAt: now, EndsAt: user.CreatedAt.Add(m.Config.Duration()), DurationDays: m.Config.DurationDays, ConfigVersion: m.Config.Version, ExpireUnclaimed: m.Config.ExpireUnclaimed}
	if err = tx.Create(&enrollment).Error; err != nil {
		return nil, err
	}
	tiers := make([]LobbyNewbieRechargeTier, 0, len(m.Config.Tiers))
	for _, t := range m.Config.Tiers {
		tiers = append(tiers, LobbyNewbieRechargeTier{UID: uid, TierID: t.ID, RequiredRecharge: t.RequiredRecharge, Reward: t.Reward})
	}
	if err = tx.Create(&tiers).Error; err != nil {
		return nil, err
	}
	return &enrollment, nil
}

func (m *NewbieModel) view(tx *gorm.DB, uid int64, now time.Time) (*NewbieView, error) {
	enrollment, err := m.enroll(tx, uid, now)
	if err != nil {
		return nil, err
	}
	v := &NewbieView{Enrollment: enrollment, Items: []*NewbieItem{}}
	// Principal paid successfully during [registration, deadline); bonuses/fees are not turnover.
	if err = tx.Model(&LobbyRechargeOrder{}).Select("COALESCE(SUM(amount),0)").Where("uid = ? AND status = 'success' AND COALESCE(settled_at,created_at) >= ? AND COALESCE(settled_at,created_at) < ? AND COALESCE(settled_at,created_at) <= ?", uid, enrollment.StartsAt, enrollment.EndsAt, now).Scan(&v.Amount).Error; err != nil {
		return nil, err
	}
	var tiers []*LobbyNewbieRechargeTier
	if err = tx.Where("uid = ?", uid).Order("required_recharge").Find(&tiers).Error; err != nil {
		return nil, err
	}
	ended := !now.Before(enrollment.EndsAt)
	eligible := enrollment.EnrolledAt.Before(enrollment.EndsAt)
	for _, t := range tiers {
		item := &NewbieItem{Tier: *t, Progress: min(v.Amount, t.RequiredRecharge), Remaining: max(t.RequiredRecharge-v.Amount, 0), Status: "locked"}
		switch {
		case t.BatchID != nil:
			item.Status = "claimed"
		case !eligible || (ended && (enrollment.ExpireUnclaimed || v.Amount < t.RequiredRecharge)):
			item.Status = "expired"
		case v.Amount >= t.RequiredRecharge:
			item.Status = "claimable"
			if v.ClaimableTotal > math.MaxInt64-t.Reward {
				return nil, xerr.ErrBalanceLimit
			}
			v.ClaimableTotal += t.Reward
		}
		v.Items = append(v.Items, item)
	}
	return v, nil
}

func (m *NewbieModel) ReadNewbie(ctx context.Context, uid int64, token string, now time.Time) (*NewbieView, error) {
	var v *NewbieView
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := (&UserModel{DB: tx}).Check(ctx, uid, token, now); err != nil {
			return err
		}
		var wallet LobbyWalletBalance
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid = ?", uid).Take(&wallet).Error; err != nil {
			return err
		}
		var err error
		v, err = m.view(tx, uid, now)
		return err
	})
	if err != nil {
		return nil, checkinError(err)
	}
	return v, nil
}

func (m *NewbieModel) ClaimNewbie(ctx context.Context, uid int64, token, requestID string, now time.Time) (*NewbieReceipt, error) {
	receipt := &NewbieReceipt{}
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := (&UserModel{DB: tx}).Check(ctx, uid, token, now); err != nil {
			return err
		}
		var wallet LobbyWalletBalance
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid = ?", uid).Take(&wallet).Error; err != nil {
			return err
		}
		err := tx.Where("uid = ? AND request_id = ?", uid, requestID).Take(&receipt.Batch).Error
		if err == nil {
			return tx.Where("batch_id = ?", receipt.Batch.ClaimID).Order("required_recharge").Find(&receipt.Items).Error
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		v, err := m.view(tx, uid, now)
		if err != nil {
			return err
		}
		if v.ClaimableTotal == 0 {
			return xerr.ErrNewbieEmpty
		}
		if wallet.Coins > math.MaxInt64-v.ClaimableTotal {
			return xerr.ErrBalanceLimit
		}
		receipt.Batch = LobbyNewbieClaimBatch{ClaimID: "nrc_" + rand.Text(), UID: uid, RequestID: requestID, TotalReward: v.ClaimableTotal, Coins: wallet.Coins + v.ClaimableTotal, CreatedAt: now}
		if err = tx.Create(&receipt.Batch).Error; err != nil {
			return err
		}
		for _, item := range v.Items {
			if item.Status != "claimable" {
				continue
			}
			tier := item.Tier
			tier.BatchID = &receipt.Batch.ClaimID
			if err = tx.Save(&tier).Error; err != nil {
				return err
			}
			receipt.Items = append(receipt.Items, &tier)
		}
		entry := LobbyCoinLedger{UID: uid, OrderID: receipt.Batch.ClaimID, Source: string(coinsource.SourceNewbieRecharge), Delta: receipt.Batch.TotalReward, BalanceBefore: wallet.Coins, BalanceAfter: receipt.Batch.Coins}
		if err = tx.Create(&entry).Error; err != nil {
			return err
		}
		return tx.Model(&wallet).Update("coins", receipt.Batch.Coins).Error
	})
	if err != nil {
		return nil, checkinError(err)
	}
	return receipt, nil
}
