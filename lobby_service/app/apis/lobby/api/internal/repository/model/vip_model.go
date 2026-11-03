package model

import (
	"context"
	"crypto/rand"
	"errors"
	"math"
	"time"

	"apps/pkg/coinsource"
	"apps/pkg/xerr"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type VIPView struct {
	State                                          *LobbyVipState
	Upgrades                                       []*LobbyVipReward
	Weekly, Monthly, WeeklyPreview, MonthlyPreview *LobbyVipReward
	UpgradeTotal                                   int64
}
type VIPReceipt struct {
	Batch LobbyVipClaimBatch
	Items []*LobbyVipReward
}

func (m *VIPModel) ReadVIP(ctx context.Context, uid int64, token string, now time.Time) (*VIPView, error) {
	v := &VIPView{}
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := (&UserModel{DB: tx}).Check(ctx, uid, token, now); err != nil {
			return err
		}
		var wallet LobbyWalletBalance
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid = ?", uid).Take(&wallet).Error; err != nil {
			return err
		}
		s, err := m.ensureState(tx, uid, now)
		if err != nil {
			return err
		}
		if err = m.advance(tx, s, now); err != nil {
			return err
		}
		v.State = s
		if err = tx.Where("uid = ? AND kind = ?", uid, "upgrade").Order("level").Find(&v.Upgrades).Error; err != nil {
			return err
		}
		for _, r := range v.Upgrades {
			if r.Status != "pending" {
				continue
			}
			if v.UpgradeTotal > math.MaxInt64-r.Amount {
				return xerr.ErrBalanceLimit
			}
			v.UpgradeTotal += r.Amount
		}
		for _, kind := range []string{"weekly", "monthly"} {
			bound := ReturnWeekly
			if kind == "monthly" {
				bound = ReturnMonthly
			}
			previous, current, end := returnBounds(now, m.location(), bound)
			saved := &LobbyVipReward{}
			err = tx.Where("uid = ? AND kind = ? AND reward_key = ?", uid, kind, previous.Format(time.DateOnly)).Take(saved).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				expires := current.AddDate(0, 0, 1)
				saved = &LobbyVipReward{Kind: kind, Status: "no_reward", PeriodStart: previous.Format(time.DateOnly), PeriodEnd: current.Format(time.DateOnly), AvailableAt: current, ExpiresAt: &expires}
			} else if err != nil {
				return err
			}
			preview, e := m.salary(tx, s, kind, current, end)
			if e != nil {
				return e
			}
			preview.Status = "preview"
			preview.RewardID = ""
			if kind == "weekly" {
				v.Weekly = saved
				v.WeeklyPreview = preview
			} else {
				v.Monthly = saved
				v.MonthlyPreview = preview
			}
		}
		return nil
	})
	if err != nil {
		return nil, checkinError(err)
	}
	return v, nil
}

func vipSource(kind string) coinsource.Source {
	switch kind {
	case "upgrade":
		return coinsource.SourceVIPUpgrade
	case "weekly":
		return coinsource.SourceVIPWeekly
	default:
		return coinsource.SourceVIPMonthly
	}
}

func (m *VIPModel) ClaimVIP(ctx context.Context, uid int64, token, kind, requestID, date string, now time.Time) (*VIPReceipt, error) {
	receipt := &VIPReceipt{}
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := (&UserModel{DB: tx}).Check(ctx, uid, token, now); err != nil {
			return err
		}
		var wallet LobbyWalletBalance
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid = ?", uid).Take(&wallet).Error; err != nil {
			return err
		}
		err := tx.Where("uid = ? AND kind = ? AND request_id = ?", uid, kind, requestID).Take(&receipt.Batch).Error
		if err == nil {
			return tx.Where("batch_id = ?", receipt.Batch.ClaimID).Order("level, reward_key").Find(&receipt.Items).Error
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		s, err := m.ensureState(tx, uid, now)
		if err != nil {
			return err
		}
		if err = m.advance(tx, s, now); err != nil {
			return err
		}
		if date != activityDate(now, m.location()) {
			return xerr.ErrReturnDate
		}
		query := tx.Where("uid = ? AND kind = ? AND status = ?", uid, kind, "pending")
		if kind != "upgrade" {
			query = query.Where("available_at <= ? AND expires_at > ?", now, now)
		}
		if err = query.Order("level, reward_key").Find(&receipt.Items).Error; err != nil {
			return err
		}
		var total int64
		for _, r := range receipt.Items {
			if total > math.MaxInt64-r.Amount {
				return xerr.ErrBalanceLimit
			}
			total += r.Amount
		}
		if total == 0 {
			return xerr.ErrVIPEmpty
		}
		if wallet.Coins > math.MaxInt64-total {
			return xerr.ErrBalanceLimit
		}
		receipt.Batch = LobbyVipClaimBatch{ClaimID: "vpc_" + rand.Text(), UID: uid, Kind: kind, RequestID: requestID, TotalReward: total, Coins: wallet.Coins + total, CreatedAt: now}
		if err = tx.Create(&receipt.Batch).Error; err != nil {
			return err
		}
		for _, r := range receipt.Items {
			r.Status = "claimed"
			r.BatchID = &receipt.Batch.ClaimID
			if err = tx.Save(r).Error; err != nil {
				return err
			}
		}
		ledger := LobbyCoinLedger{UID: uid, OrderID: receipt.Batch.ClaimID, Source: string(vipSource(kind)), Delta: total, BalanceBefore: wallet.Coins, BalanceAfter: receipt.Batch.Coins}
		if err = tx.Create(&ledger).Error; err != nil {
			return err
		}
		return tx.Model(&wallet).Update("coins", receipt.Batch.Coins).Error
	})
	if err != nil {
		return nil, checkinError(err)
	}
	return receipt, nil
}

// TickVIP is independent of client login. SQL deadlines survive process restarts.
func (m *VIPModel) TickVIP(ctx context.Context, now time.Time) error {
	var missing []int64
	if err := m.DB.WithContext(ctx).Table("lobby_users u").Select("u.uid").Where("NOT EXISTS (SELECT 1 FROM lobby_vip_states s WHERE s.uid=u.uid)").Order("u.uid").Limit(100).Scan(&missing).Error; err != nil {
		return err
	}
	var due []int64
	if err := m.DB.WithContext(ctx).Model(&LobbyVipState{}).Select("uid").Where("next_weekly_at <= ? OR next_monthly_at <= ? OR protection_end <= ? OR (level>0 AND protection_end IS NULL AND idle_since <= ?)", now, now, now, now.Add(-m.Config.IdleDuration())).Order("uid").Limit(100).Scan(&due).Error; err != nil {
		return err
	}
	for _, uid := range append(missing, due...) {
		err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
			var wallet LobbyWalletBalance
			err := tx.Clauses(clause.Locking{Strength: "UPDATE", Options: "SKIP LOCKED"}).Where("uid = ?", uid).Take(&wallet).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			if err != nil {
				return err
			}
			s, e := m.ensureState(tx, uid, now)
			if e != nil {
				return e
			}
			return m.advance(tx, s, now)
		})
		if err != nil {
			return checkinError(err)
		}
	}
	return nil
}
