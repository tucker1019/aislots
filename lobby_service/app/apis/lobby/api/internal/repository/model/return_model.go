package model

import (
	"context"
	"crypto/rand"
	"errors"
	"math"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/pkg/xerr"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ReturnModel struct{ DB *gorm.DB }

type ReturnPeriod struct {
	LobbyReturnClaim
	Status      string
	AvailableAt time.Time
	ExpiresAt   time.Time
}

type (
	ReturnSection struct{ Claim, Preview *ReturnPeriod }
	ReturnView    struct {
		Date     string
		Sections []*ReturnSection
		Total    int64
	}
)

type ReturnReceipt struct {
	Batch LobbyReturnBatch
	Items []*LobbyReturnClaim
}

func rateFor(c config.ReturnConfig, kind string) int32 {
	switch kind {
	case ReturnDaily:
		return c.DailyRateBps
	case ReturnWeekly:
		return c.WeeklyRateBps
	case ReturnMonthly:
		return c.MonthlyRateBps
	default:
		return c.LoserReturnRateBps
	}
}

func sumReturnPeriod(tx *gorm.DB, uid int64, kind string, start, end time.Time, rate int32) (*ReturnPeriod, error) {
	var totals struct{ ValidBet, BetAmount, WinAmount int64 }
	if err := tx.Model(&LobbyActivityDaily{}).Select("COALESCE(SUM(valid_bet),0) AS valid_bet, COALESCE(SUM(bet_amount),0) AS bet_amount, COALESCE(SUM(win_amount),0) AS win_amount").Where("uid = ? AND business_date >= ? AND business_date < ?", uid, start.Format(time.DateOnly), end.Format(time.DateOnly)).Scan(&totals).Error; err != nil {
		return nil, err
	}
	base := totals.ValidBet
	if kind == ReturnLoser {
		base = totals.BetAmount - totals.WinAmount
		if base < 0 {
			base = 0
		}
	}
	return &ReturnPeriod{LobbyReturnClaim: LobbyReturnClaim{UID: uid, Kind: kind, PeriodStart: start.Format(time.DateOnly), PeriodEnd: end.Format(time.DateOnly), ValidBet: totals.ValidBet, BetAmount: totals.BetAmount, WinAmount: totals.WinAmount, BaseAmount: base, RateBps: rate, Reward: returnAmount(base, rate)}, AvailableAt: end, ExpiresAt: end.AddDate(0, 0, 1)}, nil
}

func readReturns(tx *gorm.DB, uid int64, group string, c config.ReturnConfig, loc *time.Location, now time.Time) (*ReturnView, error) {
	view := &ReturnView{Date: activityDate(now, loc)}
	for _, kind := range returnKinds(group) {
		start, current, end := returnBounds(now, loc, kind)
		claim, err := sumReturnPeriod(tx, uid, kind, start, current, rateFor(c, kind))
		if err != nil {
			return nil, err
		}
		var saved LobbyReturnClaim
		err = tx.Where("uid = ? AND kind = ? AND period_start = ?", uid, kind, claim.PeriodStart).Take(&saved).Error
		switch {
		case err == nil:
			claim.LobbyReturnClaim = saved
			claim.Status = "claimed"
		case !errors.Is(err, gorm.ErrRecordNotFound):
			return nil, err
		case !now.Before(claim.ExpiresAt):
			claim.Status = "expired"
		case claim.Reward == 0:
			claim.Status = "no_reward"
		default:
			claim.Status = "claimable"
			if view.Total > math.MaxInt64-claim.Reward {
				return nil, xerr.ErrBalanceLimit
			}
			view.Total += claim.Reward
		}
		preview, err := sumReturnPeriod(tx, uid, kind, current, end, rateFor(c, kind))
		if err != nil {
			return nil, err
		}
		preview.Status = "preview"
		view.Sections = append(view.Sections, &ReturnSection{Claim: claim, Preview: preview})
	}
	return view, nil
}

func (m *ReturnModel) ReadReturns(ctx context.Context, uid int64, token, group string, c config.ReturnConfig, loc *time.Location, now time.Time) (*ReturnView, error) {
	var view *ReturnView
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := (&UserModel{DB: tx}).Check(ctx, uid, token, now); err != nil {
			return err
		}
		var wallet LobbyWalletBalance
		if err := tx.Clauses(clause.Locking{Strength: "SHARE"}).Where("uid = ?", uid).Take(&wallet).Error; err != nil {
			return err
		}
		var err error
		view, err = readReturns(tx, uid, group, c, loc, now)
		return err
	})
	if err != nil {
		return nil, checkinError(err)
	}
	return view, nil
}

func (m *ReturnModel) ClaimReturns(ctx context.Context, uid int64, token, group, date string, c config.ReturnConfig, loc *time.Location, now time.Time) (*ReturnReceipt, error) {
	receipt := &ReturnReceipt{}
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := (&UserModel{DB: tx}).Check(ctx, uid, token, now); err != nil {
			return err
		}
		var wallet LobbyWalletBalance
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid = ?", uid).Take(&wallet).Error; err != nil {
			return err
		}
		err := tx.Where("uid = ? AND reward_group = ? AND claim_date = ?", uid, group, date).Take(&receipt.Batch).Error
		if err == nil {
			return tx.Where("batch_id = ?", receipt.Batch.ClaimID).Order("kind").Find(&receipt.Items).Error
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if date != activityDate(now, loc) {
			return xerr.ErrReturnDate
		}
		view, err := readReturns(tx, uid, group, c, loc, now)
		if err != nil {
			return err
		}
		if view.Total == 0 {
			return xerr.ErrReturnEmpty
		}
		if wallet.Coins > math.MaxInt64-view.Total {
			return xerr.ErrBalanceLimit
		}
		receipt.Batch = LobbyReturnBatch{ClaimID: "ret_" + rand.Text(), UID: uid, RewardGroup: group, ClaimDate: date, TotalReward: view.Total, Coins: wallet.Coins + view.Total, CreatedAt: now}
		if err = tx.Create(&receipt.Batch).Error; err != nil {
			return err
		}
		balance := wallet.Coins
		for _, section := range view.Sections {
			p := section.Claim
			if p.Status != "claimable" {
				continue
			}
			item := p.LobbyReturnClaim
			item.BatchID = receipt.Batch.ClaimID
			if err = tx.Create(&item).Error; err != nil {
				return err
			}
			entry := LobbyCoinLedger{UID: uid, OrderID: receipt.Batch.ClaimID, Source: string(returnSource(item.Kind)), Delta: item.Reward, BalanceBefore: balance, BalanceAfter: balance + item.Reward}
			if err = tx.Create(&entry).Error; err != nil {
				return err
			}
			balance += item.Reward
		}
		if err = tx.Model(&wallet).Update("coins", receipt.Batch.Coins).Error; err != nil {
			return err
		}
		return tx.Where("batch_id = ?", receipt.Batch.ClaimID).Order("kind").Find(&receipt.Items).Error
	})
	if err != nil {
		return nil, checkinError(err)
	}
	return receipt, nil
}
