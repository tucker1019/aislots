package model

import (
	"context"
	"crypto/rand"
	"time"

	"apps/pkg/coinsource"

	"gorm.io/gorm"
)

// ExperienceModel owns the single MVP account and its durable pending command.
type ExperienceModel struct{ DB *gorm.DB }

func (m *ExperienceModel) Prepare(ctx context.Context, enabled bool, bet int64, level int, initial int64, now time.Time) (*LobbyExperienceAccount, error) {
	var a LobbyExperienceAccount
	e := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("SELECT pg_advisory_xact_lock(2026110501)").Error; err != nil {
			return err
		}
		result := tx.Where("id=1").Limit(1).Find(&a)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			if !enabled {
				return nil
			}
			u := LobbyUser{Nickname: "体验玩家", AvatarID: 1, AccountType: "experience", CreatedAt: now}
			if err := tx.Create(&u).Error; err != nil {
				return err
			}
			if err := tx.Create(&LobbyWalletBalance{UID: u.UID, Coins: initial}).Error; err != nil {
				return err
			}
			if err := tx.Create(&LobbyCoinLedger{UID: u.UID, OrderID: "experience_initial", Source: string(coinsource.SourceExperienceFunding), Delta: initial, BalanceBefore: 0, BalanceAfter: initial, CreatedAt: now}).Error; err != nil {
				return err
			}
			a = LobbyExperienceAccount{ID: 1, UID: u.UID, NextAt: now}
			if err := tx.Create(&a).Error; err != nil {
				return err
			}
		}
		if a.RequestID != "" || !enabled || now.Before(a.NextAt) {
			return nil
		}
		a.RequestID = "exp_" + rand.Text()
		a.Bet = bet
		a.BetLevel = int32(level)
		return tx.Model(&a).Updates(map[string]any{"request_id": a.RequestID, "bet": bet, "bet_level": level, "updated_at": now}).Error
	})
	if e != nil {
		return nil, e
	}
	if a.RequestID == "" {
		return nil, nil
	}
	return &a, nil
}

func (m *ExperienceModel) Finish(ctx context.Context, id, betID string, interval time.Duration) error {
	return m.DB.WithContext(ctx).Model(&LobbyExperienceAccount{}).Where("id=1 AND request_id=?", id).Updates(map[string]any{"request_id": "", "last_bet_id": betID, "next_at": time.Now().Add(interval), "updated_at": time.Now()}).Error
}
