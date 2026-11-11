package model

import (
	"apps/pkg/coinsource"
	"context"
	"crypto/rand"
	"fmt"
	"gorm.io/gorm"
	"math/big"
	"time"
)

// ExperienceJob is the durable execution projection; pending commands keep their original inputs.
type ExperienceJob struct {
	GameID    string
	ID        int32
	UID       int64
	RequestID string
	Bet       int64
	BetLevel  int32
	Rounds    int
	Country   string
	Currency  string
}

func (m *ExperienceModel) CreateScheduled(ctx context.Context, now time.Time, initial, bet int64, level int, gameID, country, currency string, delay time.Duration) error {
	return m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var due time.Time
		if err := tx.Raw("SELECT next_create_at FROM lobby_experience_schedule WHERE id=1 FOR UPDATE").Scan(&due).Error; err != nil {
			return err
		}
		if now.Before(due) {
			return nil
		}
		avatar, err := rand.Int(rand.Reader, big.NewInt(15))
		if err != nil {
			return err
		}
		u := LobbyUser{Nickname: "体验玩家", AvatarID: int32(avatar.Int64() + 1), AccountType: "experience", CreatedAt: now}
		if err := tx.Create(&u).Error; err != nil {
			return err
		}
		if err := tx.Create(&LobbyWalletBalance{UID: u.UID, Coins: initial}).Error; err != nil {
			return err
		}
		if err := tx.Create(&LobbyCoinLedger{UID: u.UID, OrderID: fmt.Sprintf("experience_initial_%d", u.UID), Source: string(coinsource.SourceExperienceFunding), Delta: initial, BalanceBefore: 0, BalanceAfter: initial, CreatedAt: now}).Error; err != nil {
			return err
		}
		if err := tx.Exec("INSERT INTO lobby_experience_accounts(uid,bet,bet_level,game_id,country,currency,next_at) VALUES(?,?,?,?,?,?,?)", u.UID, bet, level, gameID, country, currency, now).Error; err != nil {
			return err
		}
		return tx.Exec("UPDATE lobby_experience_schedule SET next_create_at=? WHERE id=1", now.Add(delay)).Error
	})
}
func (m *ExperienceModel) DueJobs(ctx context.Context, enabled bool, now time.Time) ([]ExperienceJob, error) {
	var jobs []ExperienceJob
	q := m.DB.WithContext(ctx).Table("lobby_experience_accounts").Where("request_id<>''")
	if enabled {
		q = m.DB.WithContext(ctx).Table("lobby_experience_accounts").Where("request_id<>'' OR (NOT stopped AND next_at<=?)", now)
	}
	err := q.Order("next_at,id").Find(&jobs).Error
	return jobs, err
}
func (m *ExperienceModel) BeginJob(ctx context.Context, j *ExperienceJob, lines int) error {
	if j.RequestID != "" {
		return nil
	}
	return m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var coins int64
		if err := tx.Raw("SELECT coins FROM lobby_wallet_balances WHERE uid=? FOR UPDATE", j.UID).Scan(&coins).Error; err != nil {
			return err
		}
		if coins < j.Bet*int64(j.BetLevel)*int64(lines) {
			return tx.Exec("UPDATE lobby_experience_accounts SET stopped=true,stop_reason='insufficient_funds' WHERE id=?", j.ID).Error
		}
		id := "exp_" + rand.Text()
		r := tx.Exec("UPDATE lobby_experience_accounts SET request_id=?,updated_at=now() WHERE id=? AND request_id='' AND NOT stopped", id, j.ID)
		if r.Error == nil && r.RowsAffected == 1 {
			j.RequestID = id
		}
		return r.Error
	})
}
func (m *ExperienceModel) FinishJob(ctx context.Context, j ExperienceJob, betID string, delay time.Duration, stop bool) error {
	reason := ""
	if stop {
		reason = "round_probability"
	}
	return m.DB.WithContext(ctx).Exec("UPDATE lobby_experience_accounts SET request_id='',last_bet_id=?,rounds=rounds+1,stopped=?,stop_reason=?,next_at=?,updated_at=now() WHERE id=? AND request_id=?", betID, stop, reason, time.Now().Add(delay), j.ID, j.RequestID).Error
}
func (m *ExperienceModel) StopJob(ctx context.Context, j ExperienceJob) error {
	return m.DB.WithContext(ctx).Exec("UPDATE lobby_experience_accounts SET stopped=true,stop_reason='insufficient_funds',request_id='',updated_at=now() WHERE id=? AND request_id=?", j.ID, j.RequestID).Error
}

func (m *ExperienceModel) CreationDue(ctx context.Context, now time.Time) (bool, error) {
	var due bool
	err := m.DB.WithContext(ctx).Raw("SELECT next_create_at<=? FROM lobby_experience_schedule WHERE id=1", now).Scan(&due).Error
	return due, err
}
