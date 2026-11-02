package model

import (
	"context"
	"errors"
	"time"

	"apps/pkg/xerr"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	EventGameBet         = "game_bet"
	EventGameWin         = "game_win"
	EventRechargeSuccess = "recharge_success"
)

// ActivityModel is reserved for trusted settlement adapters, never a client API.
type ActivityModel struct {
	DB       *gorm.DB
	Location *time.Location
	VIP      *VIPModel
}

func activityDate(now time.Time, loc *time.Location) string {
	if loc == nil {
		loc = time.UTC
	}
	return now.In(loc).Format(time.DateOnly)
}

// RecordEvent requires a provider-scoped unique ID and final settlement amounts.
// Game bets use Amount for actual wagers and optional ValidBetAmount for turnover.
// Call from the same transaction as game settlement when that integration exists.
func (m *ActivityModel) RecordEvent(ctx context.Context, e LobbyActivityEvent) error {
	if e.EventID == "" || len(e.EventID) > 200 || e.UID <= 0 || e.Amount <= 0 || e.OccurredAt.IsZero() || (e.EventType != EventGameBet && e.EventType != EventGameWin && e.EventType != EventRechargeSuccess) || ((e.EventType == EventGameBet || e.EventType == EventGameWin) && e.GameID == "") || (e.ValidBetAmount != nil && (e.EventType != EventGameBet || *e.ValidBetAmount < 0 || *e.ValidBetAmount > e.Amount)) {
		return xerr.ErrInvalid
	}
	e.OccurredAt = e.OccurredAt.UTC().Truncate(time.Microsecond)
	e.BusinessDate = activityDate(e.OccurredAt, m.Location)
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var wallet LobbyWalletBalance
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid = ?", e.UID).Take(&wallet).Error; err != nil {
			return err
		}
		return recordActivity(tx, &e, m.VIP)
	})
	if err != nil {
		var business *xerr.Error
		if errors.As(err, &business) {
			return business
		}
		return databaseError(err)
	}
	return nil
}

// Caller holds the wallet lock, shared with check-in claiming and recharge settlement.
func recordActivity(tx *gorm.DB, e *LobbyActivityEvent, engines ...*VIPModel) error {
	result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(e)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		var old LobbyActivityEvent
		if err := tx.Where("event_id = ?", e.EventID).Take(&old).Error; err != nil {
			return err
		}
		if old.UID != e.UID || old.EventType != e.EventType || old.GameID != e.GameID || old.Amount != e.Amount || !old.OccurredAt.Equal(e.OccurredAt) || effectiveValidBet(&old) != effectiveValidBet(e) {
			return xerr.ErrActivityConflict
		}
		return nil
	}
	daily := LobbyActivityDaily{UID: e.UID, BusinessDate: e.BusinessDate}
	if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&daily).Error; err != nil {
		return err
	}

	updates := map[string]any{}
	switch e.EventType {
	case EventRechargeSuccess:
		updates["recharge_amount"] = gorm.Expr("recharge_amount + ?", e.Amount)
	case EventGameWin:
		updates["win_amount"] = gorm.Expr("win_amount + ?", e.Amount)
	case EventGameBet:
		updates["valid_bet"] = gorm.Expr("valid_bet + ?", effectiveValidBet(e))
		updates["bet_amount"] = gorm.Expr("bet_amount + ?", e.Amount)
	}
	if err := tx.Model(&LobbyActivityDaily{}).Where("uid = ? AND business_date = ?", e.UID, e.BusinessDate).Updates(updates).Error; err != nil {
		return err
	}
	if len(engines) > 0 && engines[0] != nil {
		return engines[0].applyEvent(tx, e)
	}
	return nil
}

func effectiveValidBet(e *LobbyActivityEvent) int64 {
	if e.EventType != EventGameBet {
		return 0
	}
	if e.ValidBetAmount != nil {
		return *e.ValidBetAmount
	}
	return e.Amount
}
