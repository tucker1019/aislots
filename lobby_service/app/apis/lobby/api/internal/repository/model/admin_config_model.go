package model

import (
	"apps/app/apis/lobby/api/internal/config"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrAdminConfigConflict = errors.New("configuration version conflict")

type AdminConfigRow struct {
	Section          string          `gorm:"column:section;primaryKey"`
	Version          int64           `gorm:"column:version"`
	PublishedVersion int64           `gorm:"column:published_version"`
	DraftVersion     int64           `gorm:"column:draft_version"`
	Published        json.RawMessage `gorm:"column:published;type:jsonb"`
	Draft            json.RawMessage `gorm:"column:draft;type:jsonb"`
	UpdatedAt        time.Time       `gorm:"column:updated_at"`
}

func (AdminConfigRow) TableName() string { return "lobby_admin_configs" }

type AdminConfigVersion struct {
	ID        int64           `json:"-"`
	Section   string          `json:"-"`
	Version   int64           `json:"version"`
	Status    string          `json:"status"`
	Document  json.RawMessage `json:"-" gorm:"type:jsonb"`
	Username  string          `json:"username"`
	Reason    string          `json:"reason"`
	CreatedAt time.Time       `json:"createdAt"`
}

func (AdminConfigVersion) TableName() string { return "lobby_admin_config_versions" }

type AdminConfigRelease struct {
	ID          int64
	Section     string
	Version     int64
	RequestID   string
	Fingerprint string
	CreatedAt   time.Time
}

func (AdminConfigRelease) TableName() string { return "lobby_admin_config_releases" }

type AdminConfigStore struct{ DB *gorm.DB }

func (s AdminConfigStore) List(ctx context.Context) ([]AdminConfigRow, error) {
	v := []AdminConfigRow{}
	e := s.DB.WithContext(ctx).Order("section").Find(&v).Error
	return v, e
}
func (s AdminConfigStore) Get(ctx context.Context, key string, lock bool) (AdminConfigRow, error) {
	var r AdminConfigRow
	q := s.DB.WithContext(ctx)
	if lock {
		q = q.Clauses(clause.Locking{Strength: "UPDATE"})
	}
	e := q.Where("section=?", key).Take(&r).Error
	return r, e
}
func (s AdminConfigStore) History(ctx context.Context, key string) ([]AdminConfigVersion, error) {
	v := []AdminConfigVersion{}
	e := s.DB.WithContext(ctx).Where("section=?", key).Order("version DESC").Limit(100).Find(&v).Error
	return v, e
}
func (s AdminConfigStore) Version(ctx context.Context, key string, version int64) (AdminConfigVersion, error) {
	var v AdminConfigVersion
	e := s.DB.WithContext(ctx).Where("section=? AND version=? AND status IN ?", key, version, []string{"published", "superseded"}).Take(&v).Error
	return v, e
}
func (s AdminConfigStore) Seed(ctx context.Context, key string, doc json.RawMessage) error {
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		r := AdminConfigRow{Section: key, Version: 1, PublishedVersion: 1, Published: doc, UpdatedAt: time.Now().UTC()}
		result := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&r)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			if key == "returns" {
				current, e := (AdminConfigStore{tx}).Get(ctx, key, true)
				if e != nil {
					return e
				}
				return configurePublishedReturnRates(tx, current.Published, true)
			}
			return nil
		}
		if key == "returns" {
			if e := configurePublishedReturnRates(tx, doc, true); e != nil {
				return e
			}
		}

		v := AdminConfigVersion{Section: key, Version: 1, Status: "published", Document: doc, Username: "bootstrap", Reason: "首次初始化", CreatedAt: r.UpdatedAt}
		return tx.Create(&v).Error
	})
}
func (s AdminConfigStore) Draft(ctx context.Context, key string, expected int64, doc json.RawMessage, actor, reason string) error {
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		ss := AdminConfigStore{tx}
		row, e := ss.Get(ctx, key, true)
		if e != nil {
			return e
		}
		if row.Version != expected {
			return ErrAdminConfigConflict
		}
		next := row.Version + 1
		if e = tx.Model(&row).Updates(map[string]any{"version": next, "draft_version": next, "draft": doc, "updated_at": time.Now().UTC()}).Error; e != nil {
			return e
		}
		v := AdminConfigVersion{Section: key, Version: next, Status: "draft", Document: doc, Username: actor, Reason: reason, CreatedAt: time.Now().UTC()}
		if e = tx.Create(&v).Error; e != nil {
			return e
		}
		return InsertAdminAudit(tx, actor, "config.draft", key, reason)
	})
}

// Publish locks a section and commits the new version, release marker, and audit together.
// transform validates against the current row while holding its lock, preventing stale publication.
func (s AdminConfigStore) Publish(ctx context.Context, key string, expected int64, target int64, request, fingerprint, actor, reason string, transform func(AdminConfigRow, json.RawMessage, int64) (json.RawMessage, error)) error {
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Release IDs must become visible in commit order across sections. Without this,
		// a smaller late-committing ID can be hidden behind an already-observed MAX(id).
		if e := tx.Exec("SELECT pg_advisory_xact_lock(2026110602)").Error; e != nil {
			return e
		}

		ss := AdminConfigStore{tx}
		row, e := ss.Get(ctx, key, true)
		if e != nil {
			return e
		}
		var old AdminConfigRelease
		e = tx.Where("section=? AND request_id=?", key, request).Take(&old).Error
		if e == nil {
			if old.Fingerprint != fingerprint {
				return ErrAdminConfigConflict
			}
			return nil
		}
		if !errors.Is(e, gorm.ErrRecordNotFound) {
			return e
		}
		version := row.DraftVersion
		doc := row.Draft
		action := "config.publish"
		if target > 0 {
			action = "config.rollback"
			if row.PublishedVersion != expected {
				return ErrAdminConfigConflict
			}
			v, e := ss.Version(ctx, key, target)
			if e != nil {
				return e
			}
			version = row.Version + 1
			doc = v.Document
		} else if row.DraftVersion == 0 || row.DraftVersion != expected {
			return ErrAdminConfigConflict
		}
		doc, e = transform(row, doc, version)
		if e != nil {
			return e
		}
		if key == "returns" {
			if e = configurePublishedReturnRates(tx, doc, false); e != nil {
				return e
			}
		}
		now := time.Now().UTC()
		if target > 0 {
			v := AdminConfigVersion{Section: key, Version: version, Status: "published", Document: doc, Username: actor, Reason: reason, CreatedAt: now}
			if e = tx.Create(&v).Error; e != nil {
				return e
			}
		} else {
			if e = tx.Model(&AdminConfigVersion{}).Where("section=? AND version=?", key, version).Updates(map[string]any{"status": "published", "document": doc, "username": actor, "reason": reason, "created_at": now}).Error; e != nil {
				return e
			}
		}
		if e = tx.Model(&AdminConfigVersion{}).Where("section=? AND version=?", key, row.PublishedVersion).Update("status", "superseded").Error; e != nil {
			return e
		}
		if e = tx.Model(&row).Updates(map[string]any{"version": version, "published_version": version, "published": doc, "draft_version": 0, "draft": nil, "updated_at": now}).Error; e != nil {
			return e
		}
		if e = tx.Create(&AdminConfigRelease{Section: key, Version: version, RequestID: request, Fingerprint: fingerprint, CreatedAt: now}).Error; e != nil {
			return e
		}
		return InsertAdminAudit(tx, actor, action, key, reason)
	})
}
func (s AdminConfigStore) Revision(ctx context.Context) (int64, error) {
	var n int64
	e := s.DB.WithContext(ctx).Raw("SELECT COALESCE(MAX(id),0) FROM lobby_admin_config_releases").Scan(&n).Error
	return n, e
}
func (s AdminConfigStore) RecordRuntime(ctx context.Context, instance string, revision int64, message string) error {
	return s.DB.WithContext(ctx).Exec(`INSERT INTO lobby_admin_runtime_state(instance,revision,last_error,updated_at) VALUES (?,?,?,now()) ON CONFLICT(instance) DO UPDATE SET revision=EXCLUDED.revision,last_error=EXCLUDED.last_error,updated_at=EXCLUDED.updated_at`, instance, revision, message).Error
}

func configurePublishedReturnRates(tx *gorm.DB, doc json.RawMessage, initial bool) error {
	var rates config.ReturnConfig
	if e := json.Unmarshal(doc, &rates); e != nil {
		return e
	}
	var checkin AdminConfigRow
	if e := tx.Where("section='checkin'").Take(&checkin).Error; e != nil {
		return e
	}
	var calendar struct {
		Timezone string `json:"timezone"`
	}
	if e := json.Unmarshal(checkin.Published, &calendar); e != nil {
		return e
	}
	if calendar.Timezone == "" {
		return fmt.Errorf("checkin timezone required before return rules")
	}
	loc, e := time.LoadLocation(calendar.Timezone)
	if e != nil {
		return e
	}
	return ConfigureReturnRates(tx, rates, loc, time.Now().UTC(), initial)
}
