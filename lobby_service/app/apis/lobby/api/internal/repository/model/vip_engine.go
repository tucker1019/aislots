package model

import (
	"crypto/rand"
	"fmt"
	"math"
	"strconv"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/pkg/xerr"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type VIPModel struct {
	DB       *gorm.DB
	Config   config.VIPConfig
	Location *time.Location
	Now      func() time.Time
}

func (m *VIPModel) now() time.Time {
	if m.Now != nil {
		return m.Now().UTC()
	}
	return time.Now().UTC()
}

func (m *VIPModel) location() *time.Location {
	if m.Location == nil {
		return time.UTC
	}
	return m.Location
}

func (m *VIPModel) ensureState(tx *gorm.DB, uid int64, now time.Time) (*LobbyVipState, error) {
	_, _, week := returnBounds(now, m.location(), ReturnWeekly)
	_, _, month := returnBounds(now, m.location(), ReturnMonthly)
	s := LobbyVipState{UID: uid, IdleSince: now, NextWeeklyAt: week, NextMonthlyAt: month}
	if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&s).Error; err != nil {
		return nil, err
	}
	if err := tx.Where("uid = ?", uid).Take(&s).Error; err != nil {
		return nil, err
	}
	if int(s.Level) >= len(m.Config.Levels) {
		return nil, fmt.Errorf("VIP config missing existing level %d", s.Level)
	}
	return &s, nil
}

func clearProtection(s *LobbyVipState) {
	s.ProtectionStart = nil
	s.ProtectionEnd = nil
	s.ProtectionBet = 0
	s.ProtectionRecharge = 0
	s.ProtectionRequiredBet = 0
	s.ProtectionRequiredRecharge = 0
	s.ProtectionVersion = ""
}

// advance processes idle deadlines and payroll in time order, even after a long outage.
// Caller holds the wallet lock; a deadline is processed before activity at the same instant.
func (m *VIPModel) advance(tx *gorm.DB, s *LobbyVipState, until time.Time) error {
	for {
		next := s.NextWeeklyAt
		if s.NextMonthlyAt.Before(next) {
			next = s.NextMonthlyAt
		}
		var maintenance time.Time
		if s.Level > 0 {
			maintenance = s.IdleSince.Add(m.Config.IdleDuration())
			if s.ProtectionEnd != nil {
				maintenance = *s.ProtectionEnd
			}
			if maintenance.Before(next) || maintenance.Equal(next) {
				next = maintenance
			}
		}
		if next.After(until) {
			return tx.Save(s).Error
		}
		if !maintenance.IsZero() && maintenance.Equal(next) {
			if s.ProtectionEnd == nil {
				rule := m.Config.Levels[s.Level]
				// Entering protection starts a new progression window, including zero-target tasks.
				s.UpgradeBet = 0
				s.UpgradeRecharge = 0
				if rule.KeepBet == 0 && rule.KeepRecharge == 0 {
					s.IdleSince = next
					continue
				}
				end := next.Add(m.Config.ProtectionDuration())
				start := next
				s.ProtectionStart = &start
				s.ProtectionEnd = &end
				s.ProtectionRequiredBet = rule.KeepBet
				s.ProtectionRequiredRecharge = rule.KeepRecharge
				s.ProtectionVersion = m.Config.Version
			} else {
				s.Level--
				s.UpgradeBet = 0
				s.UpgradeRecharge = 0
				s.IdleSince = next
				clearProtection(s)
			}
			continue
		}
		if s.NextWeeklyAt.Equal(next) {
			if err := m.settleSalary(tx, s, "weekly", next); err != nil {
				return err
			}
			s.NextWeeklyAt = next.In(m.location()).AddDate(0, 0, 7)
		}
		if s.NextMonthlyAt.Equal(next) {
			if err := m.settleSalary(tx, s, "monthly", next); err != nil {
				return err
			}
			s.NextMonthlyAt = next.In(m.location()).AddDate(0, 1, 0)
		}
	}
}

func (m *VIPModel) salary(tx *gorm.DB, s *LobbyVipState, kind string, start, end time.Time) (*LobbyVipReward, error) {
	rule := m.Config.Levels[s.Level]
	amount, bet, recharge := rule.WeeklyReward, rule.WeeklyBet, rule.WeeklyRecharge
	if kind == "monthly" {
		amount, bet, recharge = rule.MonthlyReward, rule.MonthlyBet, rule.MonthlyRecharge
	}
	var totals struct{ Bet, Recharge int64 }
	if err := tx.Model(&LobbyActivityDaily{}).Select("COALESCE(SUM(valid_bet),0) AS bet,COALESCE(SUM(recharge_amount),0) AS recharge").Where("uid = ? AND business_date >= ? AND business_date < ?", s.UID, start.Format(time.DateOnly), end.Format(time.DateOnly)).Scan(&totals).Error; err != nil {
		return nil, err
	}
	expires := end.AddDate(0, 0, 1)
	r := &LobbyVipReward{RewardID: "vpr_" + rand.Text(), UID: s.UID, Kind: kind, RewardKey: start.Format(time.DateOnly), Level: s.Level, Amount: amount, Status: "pending", PeriodStart: start.Format(time.DateOnly), PeriodEnd: end.Format(time.DateOnly), AvailableAt: end, ExpiresAt: &expires, RequiredBet: bet, RequiredRecharge: recharge, ActualBet: totals.Bet, ActualRecharge: totals.Recharge, ConfigVersion: m.Config.Version}
	if totals.Bet < bet || totals.Recharge < recharge {
		r.Status = "ineligible"
	} else if amount == 0 {
		r.Status = "no_reward"
	}
	return r, nil
}

func (m *VIPModel) settleSalary(tx *gorm.DB, s *LobbyVipState, kind string, at time.Time) error {
	start := at.In(m.location()).AddDate(0, 0, -7)
	if kind == "monthly" {
		start = at.In(m.location()).AddDate(0, -1, 0)
	}
	r, err := m.salary(tx, s, kind, start, at)
	if err != nil {
		return err
	}
	return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(r).Error
}

// applyEvent is called only after a new activity event was inserted successfully.
// VIP progression uses server processing time; daily statistics retain occurred_at attribution.
func (m *VIPModel) applyEvent(tx *gorm.DB, e *LobbyActivityEvent) error {
	now := m.now()
	s, err := m.ensureState(tx, e.UID, now)
	if err != nil {
		return err
	}
	if err = m.advance(tx, s, now); err != nil {
		return err
	}
	bet, recharge := effectiveValidBet(e), int64(0)
	if e.EventType == EventRechargeSuccess {
		recharge = e.Amount
	}
	if bet == 0 && recharge == 0 {
		return nil
	}
	s.IdleSince = now
	if s.ProtectionEnd != nil {
		// Preserve all activity, including excess in a dimension that reached its target early.
		if s.ProtectionBet > math.MaxInt64-bet || s.ProtectionRecharge > math.MaxInt64-recharge {
			return xerr.ErrBalanceLimit
		}
		s.UpgradeBet = 0
		s.UpgradeRecharge = 0
		s.ProtectionBet += bet
		s.ProtectionRecharge += recharge
		if s.ProtectionBet < s.ProtectionRequiredBet || s.ProtectionRecharge < s.ProtectionRequiredRecharge {
			return tx.Save(s).Error
		}
		// Successful protection transfers the complete task totals without deducting targets.
		bet = s.ProtectionBet
		recharge = s.ProtectionRecharge
		clearProtection(s)
	}
	if s.UpgradeBet > math.MaxInt64-bet || s.UpgradeRecharge > math.MaxInt64-recharge {
		return xerr.ErrBalanceLimit
	}
	s.UpgradeBet += bet
	s.UpgradeRecharge += recharge
	for int(s.Level)+1 < len(m.Config.Levels) {
		next := m.Config.Levels[s.Level+1]
		if s.UpgradeBet < next.UpgradeBet || s.UpgradeRecharge < next.UpgradeRecharge {
			break
		}
		s.UpgradeBet -= next.UpgradeBet
		s.UpgradeRecharge -= next.UpgradeRecharge
		s.Level++
		if s.Level > s.HighestLevel {
			s.HighestLevel = s.Level
			status := "pending"
			if next.UpgradeReward == 0 {
				status = "no_reward"
			}
			reward := LobbyVipReward{RewardID: "vpr_" + rand.Text(), UID: s.UID, Kind: "upgrade", RewardKey: strconv.Itoa(int(s.Level)), Level: s.Level, Amount: next.UpgradeReward, Status: status, AvailableAt: now, ConfigVersion: m.Config.Version}
			if err = tx.Create(&reward).Error; err != nil {
				return err
			}
		}
	}
	return tx.Save(s).Error
}
