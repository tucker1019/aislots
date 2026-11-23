package model

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"apps/app/apis/lobby/api/internal/config"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type RewardNotificationModel struct {
	DB       *gorm.DB
	Location *time.Location
}

type rewardPeriod struct {
	Kind      string
	Board     string
	Start     time.Time
	End       time.Time
	Available time.Time
	Expires   time.Time
}

type rewardNotificationTarget struct {
	ID             int64
	RewardType     string
	PeriodStart    string
	Board          string
	UID            int64
	RewardAmount   int64
	ActionPath     string
	AvailableAt    time.Time
	ExpiresAt      time.Time
	SendSettlement bool
	ReminderHours  []byte
	SendExpired    bool
}

// Process runs settlement discovery and due mail stages. The period and stage
// unique keys make repeated ticks and concurrent service instances idempotent.
func (m *RewardNotificationModel) Process(ctx context.Context, cfg config.Config, now time.Time) error {
	loc := m.Location
	if loc == nil {
		loc = time.UTC
	}
	localNow := now.In(loc)
	today := time.Date(localNow.Year(), localNow.Month(), localNow.Day(), 0, 0, 0, 0, loc)
	from := today.AddDate(0, 0, -70)

	if err := m.discoverReturnNotifications(ctx, from, today, cfg, now); err != nil {
		return err
	}
	if err := m.settleLeaderboardRewards(ctx, from, today, cfg, now); err != nil {
		return err
	}
	return m.dispatchDue(ctx, now, from.AddDate(0, 0, -2))
}

func (m *RewardNotificationModel) discoverReturnNotifications(ctx context.Context, from, today time.Time, cfg config.Config, now time.Time) error {
	var dates []string
	if err := m.DB.WithContext(ctx).Table("lobby_activity_daily").Distinct("business_date").Where("business_date >= ? AND business_date < ?", from.Format(time.DateOnly), today.Format(time.DateOnly)).Order("business_date").Pluck("business_date", &dates).Error; err != nil {
		return err
	}
	_, err := m.discoverReturnPeriods(ctx, dates, now, cfg)
	return err
}

func (m *RewardNotificationModel) discoverReturnPeriods(ctx context.Context, dates []string, now time.Time, cfg config.Config) ([]rewardPeriod, error) {
	location := m.Location
	if location == nil {
		location = time.UTC
	}
	unique := map[string]rewardPeriod{}
	for _, date := range dates {
		start, err := time.ParseInLocation(time.DateOnly, date, location)
		if err != nil {
			return nil, err
		}
		add := func(kind string, periodStart, periodEnd time.Time) {
			available := periodEnd
			if available.After(now.In(location)) {
				return
			}
			period := rewardPeriod{Kind: kind, Start: periodStart, End: periodEnd, Available: available, Expires: available.AddDate(0, 0, 1)}
			unique[kind+":"+periodStart.Format(time.DateOnly)] = period
		}
		add(ReturnDaily, start, start.AddDate(0, 0, 1))
		add(ReturnLoser, start, start.AddDate(0, 0, 1))
		weekStart := start.AddDate(0, 0, -(int(start.Weekday())+6)%7)
		add(ReturnWeekly, weekStart, weekStart.AddDate(0, 0, 7))
		monthStart := time.Date(start.Year(), start.Month(), 1, 0, 0, 0, 0, start.Location())
		add(ReturnMonthly, monthStart, monthStart.AddDate(0, 1, 0))
	}
	periods := make([]rewardPeriod, 0, len(unique))
	for _, period := range unique {
		periods = append(periods, period)
	}
	sortPeriods(periods)
	for _, period := range periods {
		if m.DB == nil {
			continue
		}
		if err := m.settleReturnPeriod(ctx, period, cfg, now); err != nil {
			return nil, err
		}
	}
	return periods, nil
}

func (m *RewardNotificationModel) discoverReturnPeriodsFromDates(dates []string, now time.Time) ([]rewardPeriod, error) {
	return m.discoverReturnPeriods(context.Background(), dates, now, config.Config{RewardNotifications: config.DefaultRewardNotifications()})
}

func sortPeriods(periods []rewardPeriod) {
	sort.Slice(periods, func(i, j int) bool {
		if periods[i].Available.Equal(periods[j].Available) {
			if periods[i].Kind == periods[j].Kind {
				return periods[i].Start.Before(periods[j].Start)
			}
			return periods[i].Kind < periods[j].Kind
		}
		return periods[i].Available.Before(periods[j].Available)
	})
}

func ruleFor(cfg config.RewardNotificationsConfig, kind string) config.RewardNotificationRule {
	switch kind {
	case "leaderboard":
		return cfg.Leaderboard
	case ReturnLoser:
		return cfg.LossReturn
	default:
		return cfg.Rebate
	}
}

func notificationRewardType(kind string) string {
	switch kind {
	case ReturnDaily:
		return "rebate_daily"
	case ReturnWeekly:
		return "rebate_weekly"
	case ReturnMonthly:
		return "rebate_monthly"
	default:
		return "loss_return"
	}
}

func (m *RewardNotificationModel) settleReturnPeriod(ctx context.Context, period rewardPeriod, cfg config.Config, now time.Time) error {
	rewardType := notificationRewardType(period.Kind)
	rule := ruleFor(cfg.RewardNotifications, rewardType)
	reminders, err := json.Marshal(rule.ReminderHours)
	if err != nil {
		return err
	}
	if err := m.discoverReturnTargets(ctx, period, cfg, rule, reminders); err != nil {
		return err
	}
	if err = m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		result := tx.Exec(`INSERT INTO lobby_reward_notification_periods
(reward_type,period_start,period_end,available_at,expires_at,send_on_settlement,reminder_hours,send_on_expired)
VALUES(?,?,?,?,?,?,?::jsonb,?) ON CONFLICT DO NOTHING`, rewardType, period.Start.Format(time.DateOnly), period.End.Format(time.DateOnly), period.Available, period.Expires, rule.SendOnSettlement, string(reminders), rule.SendOnExpired)
		return result.Error
	}); err != nil {
		return err
	}
	_ = now
	return nil
}

func (m *RewardNotificationModel) discoverReturnTargets(ctx context.Context, period rewardPeriod, cfg config.Config, rule config.RewardNotificationRule, reminders []byte) error {
	return m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var uids []int64
		if err := tx.Table("lobby_activity_daily").Distinct("uid").Where("business_date >= ? AND business_date < ?", period.Start.Format(time.DateOnly), period.End.Format(time.DateOnly)).Order("uid").Pluck("uid", &uids).Error; err != nil {
			return err
		}
		for _, uid := range uids {
			rate, err := effectiveReturnRate(tx, cfg.Returns, period.Kind, period.Start)
			if err != nil {
				return err
			}
			policy := config.LossReturnConfig{}
			if period.Kind == ReturnLoser {
				policy, err = effectiveLossPolicy(tx, cfg.Returns, period.Start)
				if err != nil {
					return err
				}
			}
			calculated, err := sumReturnPeriod(tx, uid, period.Kind, period.Start, period.End, rate, policy)
			if err != nil {
				return err
			}
			if calculated.Reward <= 0 {
				continue
			}
			if err = insertNotificationTarget(tx, notificationRewardType(period.Kind), period.Start, "", uid, calculated.Reward, 0, "/earn", period.Available, period.Expires, rule, reminders); err != nil {
				return err
			}
		}
		return nil
	})
}

func insertNotificationTarget(tx *gorm.DB, rewardType string, periodStart time.Time, board string, uid, amount int64, rank int, actionPath string, available, expires time.Time, rule config.RewardNotificationRule, reminders []byte) error {
	return tx.Exec(`INSERT INTO lobby_reward_notification_targets
(reward_type,period_start,board,uid,reward_amount,rank,action_path,available_at,expires_at,send_on_settlement,reminder_hours,send_on_expired)
VALUES(?,?,?,?,?,?,?,?,?,?,?::jsonb,?) ON CONFLICT DO NOTHING`, rewardType, periodStart.Format(time.DateOnly), board, uid, amount, rank, actionPath, available, expires, rule.SendOnSettlement, string(reminders), rule.SendOnExpired).Error
}

func (m *RewardNotificationModel) settleLeaderboardRewards(ctx context.Context, from, today time.Time, cfg config.Config, now time.Time) error {
	var dates []string
	location := m.Location
	if location == nil {
		location = time.UTC
	}
	if err := m.DB.WithContext(ctx).Raw(`SELECT DISTINCT to_char(ended_at AT TIME ZONE ?, 'YYYY-MM-DD') AS business_date
FROM lobby_game_completions WHERE included=true AND ended_at >= ? AND ended_at < ? ORDER BY business_date`, location.String(), from.UTC(), today.UTC()).Scan(&dates).Error; err != nil {
		return err
	}
	for _, value := range dates {
		day, err := time.ParseInLocation(time.DateOnly, value, location)
		if err != nil {
			return err
		}
		game := &GameModel{DB: m.DB, Location: location}
		for _, board := range []string{"wins", "multiplier"} {
			if err = game.EnsurePlatformLeaderboardRewards(ctx, day, board, cfg.Leaderboard.Rewards); err != nil {
				return err
			}
		}
		if !day.AddDate(0, 0, 1).After(now) {
			if err = m.settleLeaderboardDay(ctx, day, cfg.RewardNotifications.Leaderboard); err != nil {
				return err
			}
		}
	}
	_ = today
	return nil
}

func (m *RewardNotificationModel) settleLeaderboardDay(ctx context.Context, day time.Time, rule config.RewardNotificationRule) error {
	location := m.Location
	if location == nil {
		location = time.UTC
	}
	start := time.Date(day.In(location).Year(), day.In(location).Month(), day.In(location).Day(), 0, 0, 0, 0, location)
	available := start.AddDate(0, 0, 1)
	expires := available.AddDate(0, 0, 1)
	reminders, err := json.Marshal(rule.ReminderHours)
	if err != nil {
		return err
	}
	var rows []struct {
		UID    int64
		Amount int64
	}
	if err = m.DB.WithContext(ctx).Table("lobby_platform_leaderboard_rewards").Select("uid, SUM(amount) AS amount").
		Where("business_date=? AND anonymous=false AND amount>0 AND claim_id IS NULL AND status IN ('claimable','expired')", start.Format(time.DateOnly)).
		Group("uid").Order("uid").Scan(&rows).Error; err != nil {
		return err
	}
	if err = m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for _, row := range rows {
			if err := insertNotificationTarget(tx, "leaderboard", start, "", row.UID, row.Amount, 0, "/platform-leaderboard", available, expires, rule, reminders); err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return err
	}
	if err = m.DB.WithContext(ctx).Exec(`UPDATE lobby_platform_leaderboard_rewards SET status='expired' WHERE business_date=? AND board IN ('wins','multiplier') AND status='claimable' AND expires_at<=?`, start.Format(time.DateOnly), time.Now().UTC()).Error; err != nil {
		return err
	}
	return m.DB.WithContext(ctx).Exec(`INSERT INTO lobby_reward_notification_periods
(reward_type,period_start,period_end,board,available_at,expires_at,send_on_settlement,reminder_hours,send_on_expired)
VALUES('leaderboard',?,?,'',?,?,?,?::jsonb,?) ON CONFLICT DO NOTHING`, start.Format(time.DateOnly), available.Format(time.DateOnly), available, expires, rule.SendOnSettlement, string(reminders), rule.SendOnExpired).Error
}

func (m *RewardNotificationModel) dispatchDue(ctx context.Context, now, from time.Time) error {
	var targets []rewardNotificationTarget
	err := m.DB.WithContext(ctx).Table("lobby_reward_notification_targets").
		Select("id,reward_type,period_start::text,board,uid,reward_amount,action_path,available_at,expires_at,send_on_settlement,reminder_hours,send_on_expired").
		Where("available_at <= ? AND expires_at >= ?", now, from).Order("available_at,id").Find(&targets).Error
	if err != nil {
		return err
	}
	for _, target := range targets {
		if err = m.dispatchStage(ctx, target.ID, "settlement", now); err != nil {
			return err
		}
		var hours []int32
		if err = json.Unmarshal(target.ReminderHours, &hours); err != nil {
			return fmt.Errorf("invalid reminder snapshot for reward target %d: %w", target.ID, err)
		}
		sort.Slice(hours, func(i, j int) bool { return hours[i] > hours[j] })
		for _, value := range hours {
			stage := fmt.Sprintf("reminder_%d", value)
			if err = m.dispatchStage(ctx, target.ID, stage, now); err != nil {
				return err
			}
		}
		if err = m.dispatchStage(ctx, target.ID, "expired", now); err != nil {
			return err
		}
	}
	return nil
}

func (m *RewardNotificationModel) dispatchStage(ctx context.Context, targetID int64, stage string, now time.Time) error {
	return m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var target rewardNotificationTarget
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Table("lobby_reward_notification_targets").
			Select("id,reward_type,period_start::text,board,uid,reward_amount,action_path,available_at,expires_at,send_on_settlement,reminder_hours,send_on_expired").
			Where("id=?", targetID).Take(&target).Error; err != nil {
			return err
		}
		var existing int64
		if err := tx.Table("lobby_reward_notification_dispatches").Where("target_id=? AND stage_key=?", targetID, stage).Count(&existing).Error; err != nil {
			return err
		}
		if existing > 0 {
			return nil
		}
		due, enabled := stageDue(target, stage, now)
		if !due {
			return nil
		}
		claimed, err := targetClaimed(tx, target, stage, now)
		if err != nil {
			return err
		}
		if claimed || !enabled {
			return tx.Exec(`INSERT INTO lobby_reward_notification_dispatches(target_id,stage_key,status) VALUES(?,?,'skipped') ON CONFLICT DO NOTHING`, targetID, stage).Error
		}
		var mailID int64
		if err = tx.Raw(`INSERT INTO lobby_player_mails(uid,target_id,stage_key) VALUES(?,?,?) ON CONFLICT DO NOTHING RETURNING id`, target.UID, targetID, stage).Scan(&mailID).Error; err != nil {
			return err
		}
		if mailID == 0 {
			return tx.Exec(`INSERT INTO lobby_reward_notification_dispatches(target_id,stage_key,status) VALUES(?,?,'skipped') ON CONFLICT DO NOTHING`, targetID, stage).Error
		}
		return tx.Exec(`INSERT INTO lobby_reward_notification_dispatches(target_id,stage_key,status,mail_id) VALUES(?,?,'sent',?) ON CONFLICT DO NOTHING`, targetID, stage, mailID).Error
	})
}

func stageDue(target rewardNotificationTarget, stage string, now time.Time) (bool, bool) {
	switch {
	case stage == "settlement":
		return !now.Before(target.AvailableAt), target.SendSettlement && now.Before(target.ExpiresAt)
	case stage == "expired":
		return !now.Before(target.ExpiresAt), target.SendExpired
	case strings.HasPrefix(stage, "reminder_"):
		hours, err := time.ParseDuration(strings.TrimPrefix(stage, "reminder_") + "h")
		if err != nil {
			return false, false
		}
		dueAt := target.ExpiresAt.Add(-hours)
		return !now.Before(dueAt) && now.Before(target.ExpiresAt), true
	default:
		return false, false
	}
}

func (m *RewardNotificationModel) ProcessStage(ctx context.Context, targetID int64, stage string, now time.Time) error {
	if targetID <= 0 {
		return fmt.Errorf("invalid notification target")
	}
	return m.dispatchStage(ctx, targetID, stage, now)
}

func targetClaimed(tx *gorm.DB, target rewardNotificationTarget, stage string, now time.Time) (bool, error) {
	var count int64
	if target.RewardType == "leaderboard" {
		query := tx.Table("lobby_platform_leaderboard_rewards").Where("uid=? AND business_date=? AND amount>0 AND anonymous=false AND claim_id IS NULL", target.UID, target.PeriodStart)
		if stage == "expired" {
			query = query.Where("expires_at<=?", now)
		} else {
			query = query.Where("expires_at>?", now)
		}
		err := query.Count(&count).Error
		return count == 0, err
	}
	kind := strings.TrimPrefix(target.RewardType, "rebate_")
	if target.RewardType == "loss_return" {
		kind = ReturnLoser
	}
	err := tx.Table("lobby_return_claims").Where("uid=? AND kind=? AND period_start=?", target.UID, kind, target.PeriodStart).Count(&count).Error
	if err != nil { return false, err }
	if count > 0 { return true, nil }
	if stage == "expired" { return now.Before(target.ExpiresAt), nil }
	return !now.Before(target.ExpiresAt), nil
}
