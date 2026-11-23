package model

import (
	"context"
	"testing"
	"time"
)

func TestRewardNotificationStagesAreIdempotentAndSkipClaimed(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	now := time.Date(2026, 11, 24, 12, 0, 0, 0, time.UTC)
	uid, err := (&UserModel{DB: db}).Create(ctx, "", "", "mail-model-session", now.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	periodStart := time.Date(2026, 11, 23, 0, 0, 0, 0, time.UTC)
	target := rewardNotificationTarget{
		RewardType:     ReturnDaily,
		PeriodStart:    periodStart.Format(time.DateOnly),
		UID:            uid,
		AvailableAt:    now.Add(-12 * time.Hour),
		ExpiresAt:      now.Add(12 * time.Hour),
		SendSettlement: true,
		ReminderHours:  []byte(`[12,6]`),
		SendExpired:    true,
	}
	if err = db.Exec(`INSERT INTO lobby_reward_notification_targets(reward_type,period_start,board,uid,reward_amount,action_path,available_at,expires_at,send_on_settlement,reminder_hours,send_on_expired) VALUES(?,?,?,?,?,?,?,?,?,?::jsonb,?)`, target.RewardType, target.PeriodStart, "", uid, 1, "/earn", target.AvailableAt, target.ExpiresAt, true, `[12,6]`, true).Error; err != nil {
		t.Fatal(err)
	}
	var targetID int64
	if err = db.Raw("SELECT id FROM lobby_reward_notification_targets WHERE uid=?", uid).Scan(&targetID).Error; err != nil {
		t.Fatal(err)
	}
	model := &RewardNotificationModel{DB: db}
	if err = model.ProcessStage(ctx, targetID, "settlement", now); err != nil {
		t.Fatal(err)
	}
	if err = model.ProcessStage(ctx, targetID, "settlement", now); err != nil {
		t.Fatal(err)
	}
	var count int64
	if err = db.Table("lobby_player_mails").Where("uid=?", uid).Count(&count).Error; err != nil || count != 1 {
		t.Fatal("settlement notification duplicated", count, err)
	}
	if err = db.Create(&LobbyReturnClaim{UID: uid, Kind: ReturnDaily, PeriodStart: target.PeriodStart}).Error; err != nil {
		t.Fatal(err)
	}
	if err = model.ProcessStage(ctx, targetID, "reminder_12", now); err != nil {
		t.Fatal(err)
	}
	if err = db.Table("lobby_reward_notification_dispatches").Where("target_id=? AND stage_key='reminder_12' AND status='skipped'", targetID).Count(&count).Error; err != nil || count != 1 {
		t.Fatal("claimed reward was not skipped", count, err)
	}
	if err = model.ProcessStage(ctx, targetID, "expired", target.ExpiresAt); err != nil {
		t.Fatal(err)
	}
	if err = model.ProcessStage(ctx, targetID, "expired", target.ExpiresAt); err != nil {
		t.Fatal(err)
	}
	if err = db.Table("lobby_player_mails").Where("uid=?", uid).Count(&count).Error; err != nil || count != 1 {
		t.Fatal("claimed reward received expiry mail", count, err)
	}
	model2 := &MailModel{DB: db}
	items, _, more, err := model2.List(ctx, uid, "mail-model-session", now, "", 10)
	if err != nil || more || len(items) != 1 || items[0].NoticeType != "settlement" || !items[0].Unread {
		t.Fatal("mail list response", items, more, err)
	}
	if err = model2.MarkRead(ctx, uid, "mail-model-session", now, items[0].ID); err != nil {
		t.Fatal(err)
	}
	items, _, _, err = model2.List(ctx, uid, "mail-model-session", now, "", 10)
	if err != nil || len(items) != 1 || items[0].Unread {
		t.Fatal("read status", items, err)
	}
	if err = model2.Delete(ctx, uid, "mail-model-session", now, items[0].ID); err != nil {
		t.Fatal(err)
	}
	items, _, _, err = model2.List(ctx, uid, "mail-model-session", now, "", 10)
	if err != nil || len(items) != 0 {
		t.Fatal("soft delete", items, err)
	}
}

func TestNotificationPeriodDatesAreLocalCalendarWindows(t *testing.T) {
	loc, err := time.LoadLocation("Asia/Jakarta")
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 11, 24, 12, 0, 0, 0, loc)
	model := &RewardNotificationModel{Location: loc}
	periods, err := model.discoverReturnPeriodsFromDates([]string{"2026-11-23", "2026-11-17", "2026-10-31"}, now)
	if err != nil {
		t.Fatal(err)
	}
	byKey := map[string]rewardPeriod{}
	for _, period := range periods {
		byKey[period.Kind+":"+period.Start.Format(time.DateOnly)] = period
	}
	daily := byKey[ReturnDaily+":2026-11-23"]
	if daily.Available.Format(time.RFC3339) != "2026-11-24T00:00:00+07:00" || daily.Expires.Format(time.RFC3339) != "2026-11-25T00:00:00+07:00" {
		t.Fatal("daily activity date window", daily)
	}
	weekly := byKey[ReturnWeekly+":2026-11-16"]
	if weekly.Available.Format(time.DateOnly) != "2026-11-23" || weekly.Expires.Format(time.DateOnly) != "2026-11-24" {
		t.Fatal("weekly activity date window", weekly)
	}
	monthly := byKey[ReturnMonthly+":2026-10-01"]
	if monthly.Available.Format(time.DateOnly) != "2026-11-01" || monthly.Expires.Format(time.DateOnly) != "2026-11-02" {
		t.Fatal("monthly activity date window", monthly)
	}
}
