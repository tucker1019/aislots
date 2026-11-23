package model

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"apps/pkg/xerr"

	"gorm.io/gorm"
)

type MailModel struct{ DB *gorm.DB }

type PlayerMail struct {
	ID            int64
	RewardType    string
	NoticeType    string
	ReminderHours int32
	BusinessDate  string
	Deadline      time.Time
	ActionPath    string
	SentAt        time.Time
	Unread        bool
}

func (m *MailModel) List(ctx context.Context, uid int64, token string, now time.Time, cursor string, limit int) ([]PlayerMail, string, bool, error) {
	if uid <= 0 || limit < 1 || limit > 100 {
		return nil, "", false, xerr.ErrInvalid
	}
	var cursorID int64
	var err error
	if cursor != "" {
		cursorID, err = strconv.ParseInt(cursor, 10, 64)
		if err != nil || cursorID <= 0 {
			return nil, "", false, xerr.ErrInvalid
		}
	}
	var items []PlayerMail
	err = m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := (&UserModel{DB: tx}).Check(ctx, uid, token, now); err != nil {
			return err
		}
		query := tx.Table("lobby_player_mails AS mail").
			Select(`mail.id, target.reward_type, mail.stage_key AS notice_type, target.period_start::text AS business_date,
target.expires_at AS deadline, target.action_path, mail.sent_at, (mail.read_at IS NULL) AS unread`).
			Joins("JOIN lobby_reward_notification_targets AS target ON target.id=mail.target_id").
			Where("mail.uid=? AND mail.deleted_at IS NULL", uid)
		if cursorID > 0 {
			query = query.Where("mail.id < ?", cursorID)
		}
		if err := query.Order("mail.id DESC").Limit(limit + 1).Scan(&items).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return nil, "", false, mailDatabaseError(err)
	}
	hasMore := len(items) > limit
	if hasMore {
		items = items[:limit]
	}
	next := ""
	if hasMore && len(items) > 0 {
		next = strconv.FormatInt(items[len(items)-1].ID, 10)
	}
	for i := range items {
		items[i].NoticeType, items[i].ReminderHours = mailStage(items[i].NoticeType)
	}
	return items, next, hasMore, nil
}

func mailStage(stage string) (string, int32) {
	if stage == "settlement" || stage == "expired" {
		return stage, 0
	}
	if strings.HasPrefix(stage, "reminder_") {
		parsed, err := strconv.ParseInt(strings.TrimPrefix(stage, "reminder_"), 10, 32)
		if err == nil && parsed > 0 {
			return "reminder", int32(parsed)
		}
	}
	return "settlement", 0
}

func (m *MailModel) MarkRead(ctx context.Context, uid int64, token string, now time.Time, id int64) error {
	return m.update(ctx, uid, token, now, id, "read_at")
}

func (m *MailModel) Delete(ctx context.Context, uid int64, token string, now time.Time, id int64) error {
	return m.update(ctx, uid, token, now, id, "deleted_at")
}

func (m *MailModel) ReadAll(ctx context.Context, uid int64, token string, now time.Time) error {
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := (&UserModel{DB: tx}).Check(ctx, uid, token, now); err != nil {
			return err
		}
		return tx.Exec(`UPDATE lobby_player_mails SET read_at=COALESCE(read_at,?) WHERE uid=? AND deleted_at IS NULL`, now, uid).Error
	})
	return mailDatabaseError(err)
}

func (m *MailModel) update(ctx context.Context, uid int64, token string, now time.Time, id int64, column string) error {
	if uid <= 0 || id <= 0 || (column != "read_at" && column != "deleted_at") {
		return xerr.ErrInvalid
	}
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := (&UserModel{DB: tx}).Check(ctx, uid, token, now); err != nil {
			return err
		}
		result := tx.Exec("UPDATE lobby_player_mails SET "+column+"=COALESCE("+column+",?) WHERE id=? AND uid=? AND deleted_at IS NULL", now, id, uid)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return xerr.ErrInvalid
		}
		return nil
	})
	return mailDatabaseError(err)
}

func mailDatabaseError(err error) error {
	if err == nil {
		return nil
	}
	var business *xerr.Error
	if errors.As(err, &business) {
		return business
	}
	return databaseError(err)
}
