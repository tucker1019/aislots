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

type CheckinModel struct{ DB *gorm.DB }

type CheckinState struct {
	Date    string
	Day     int32
	Claimed bool
	Daily   LobbyActivityDaily
	Rule    config.CheckinDay
}

func currentCheckin(tx *gorm.DB, uid int64, c config.CheckinConfig, now time.Time) (*CheckinState, error) {
	date := activityDate(now, c.Location())
	s := &CheckinState{Date: date, Day: 1}
	var last LobbyCheckinClaim
	err := tx.Where("uid = ? AND business_date <= ?", uid, date).Order("business_date DESC").Take(&last).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	yesterday := now.In(c.Location()).AddDate(0, 0, -1).Format(time.DateOnly)
	if err == nil {
		if last.BusinessDate == date {
			s.Claimed = true
			s.Day = last.Day
			s.Rule = config.CheckinDay{RequiredBet: last.RequiredBet, RequiredRecharge: last.RequiredRecharge, Reward: last.Reward}
		}
		if last.BusinessDate == yesterday && last.ConfigVersion == c.Version {
			s.Day = last.Day%int32(len(c.Days)) + 1
		}
	}
	if !s.Claimed {
		s.Rule = c.Days[s.Day-1]
	}
	err = tx.Where("uid = ? AND business_date = ?", uid, date).Take(&s.Daily).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		err = nil
	}
	return s, err
}

func (m *CheckinModel) ReadCheckin(ctx context.Context, uid int64, token string, c config.CheckinConfig, now time.Time) (*CheckinState, error) {
	var state *CheckinState
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := (&UserModel{DB: tx}).Check(ctx, uid, token, now); err != nil {
			return err
		}
		var wallet LobbyWalletBalance
		if err := tx.Clauses(clause.Locking{Strength: "SHARE"}).Where("uid = ?", uid).Take(&wallet).Error; err != nil {
			return err
		}
		var err error
		state, err = currentCheckin(tx, uid, c, now)
		return err
	})
	if err != nil {
		return nil, checkinError(err)
	}
	return state, nil
}

func (m *CheckinModel) ClaimCheckin(ctx context.Context, uid int64, token, date string, c config.CheckinConfig, now time.Time) (*LobbyCheckinClaim, error) {
	var claim LobbyCheckinClaim
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := (&UserModel{DB: tx}).Check(ctx, uid, token, now); err != nil {
			return err
		}
		var wallet LobbyWalletBalance
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid = ?", uid).Take(&wallet).Error; err != nil {
			return err
		}
		err := tx.Where("uid = ? AND business_date = ?", uid, date).Take(&claim).Error
		if err == nil {
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if date != activityDate(now, c.Location()) {
			return xerr.ErrCheckinDate
		}
		s, err := currentCheckin(tx, uid, c, now)
		if err != nil {
			return err
		}
		if s.Daily.ValidBet < s.Rule.RequiredBet || s.Daily.RechargeAmount < s.Rule.RequiredRecharge {
			return xerr.ErrCheckinCondition
		}
		if wallet.Coins > math.MaxInt64-s.Rule.Reward {
			return xerr.ErrBalanceLimit
		}
		claim = LobbyCheckinClaim{ClaimID: "chk_" + rand.Text(), UID: uid, BusinessDate: date, Day: s.Day, ConfigVersion: c.Version, RequiredBet: s.Rule.RequiredBet, RequiredRecharge: s.Rule.RequiredRecharge, Reward: s.Rule.Reward, Coins: wallet.Coins + s.Rule.Reward, CreatedAt: now}
		if err = tx.Create(&claim).Error; err != nil {
			return err
		}
		entry := LobbyCoinLedger{UID: uid, OrderID: claim.ClaimID, Source: string(coinsource.SourceCheckinReward), Delta: claim.Reward, BalanceBefore: wallet.Coins, BalanceAfter: claim.Coins}
		if err = tx.Create(&entry).Error; err != nil {
			return err
		}
		return tx.Model(&wallet).Update("coins", claim.Coins).Error
	})
	if err != nil {
		return nil, checkinError(err)
	}
	return &claim, nil
}

func checkinError(err error) error {
	var business *xerr.Error
	if errors.As(err, &business) {
		return business
	}
	return databaseError(err)
}
