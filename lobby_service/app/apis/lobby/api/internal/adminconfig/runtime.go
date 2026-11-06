package adminconfig

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/model"
	"gorm.io/gorm"
)

// Seed imports deployment defaults only for sections absent from the database.
// Restart never overwrites an existing published document or an operator's draft.
func Seed(ctx context.Context, db *gorm.DB, c config.Config) error {
	existing, e := (model.AdminConfigStore{DB: db}).List(ctx)
	if e != nil {
		return e
	}
	found := map[string]bool{}
	for _, r := range existing {
		found[r.Section] = true
	}
	values := map[string]any{"content": c.Content, "recharge": c.RechargeTiers, "withdrawal": c.WithdrawalTiers, "checkin": c.Checkin, "returns": c.Returns, "turnover": c.Turnover, "agent": c.Agent, "vip": c.VIP, "invite": c.Invite, "newbie-recharge": c.Newbie, "games": c.Game}
	for _, s := range Sections {
		if found[s.Key] && s.Key != "returns" {
			continue
		}
		v := values[s.Key]
		if s.Key == "experience" {
			x, e := config.LoadExperience(os.Getenv("LOBBY_EXPERIENCE_CONFIG"))
			if e != nil {
				return e
			}
			v = x
		}
		b, e := json.Marshal(v)
		if e != nil {
			return e
		}
		if e = ValidateDocument(s.Key, b); e != nil {
			return e
		}
		if e = (model.AdminConfigStore{DB: db}).Seed(ctx, s.Key, b); e != nil {
			return e
		}
	}
	return nil
}
func LoadPublished(ctx context.Context, db *gorm.DB, base config.Config) (config.Config, error) {
	rows, e := (model.AdminConfigStore{DB: db}).List(ctx)
	if e != nil {
		return base, e
	}
	out := base
	for _, r := range rows {
		if !known(r.Section) {
			continue
		}
		if e = applyDocument(&out, r.Section, r.Published); e != nil {
			return base, e
		}
	}
	return out, nil
}
func LoadExperiencePublished(ctx context.Context, db *gorm.DB, fallback config.ExperienceConfig) (config.ExperienceConfig, error) {
	r, e := (model.AdminConfigStore{DB: db}).Get(ctx, "experience", false)
	if e != nil {
		return fallback, e
	}
	if e = ValidateDocument("experience", r.Published); e != nil {
		return fallback, e
	}
	var c config.ExperienceConfig
	e = json.Unmarshal(r.Published, &c)
	return c, e
}
func PublishedRevision(ctx context.Context, db *gorm.DB) (int64, error) {
	return (model.AdminConfigStore{DB: db}).Revision(ctx)
}

// LoadSnapshot pins release revision and all published documents to one PostgreSQL snapshot.
// Reading them in separate transactions can otherwise miss a publication during startup.
func LoadSnapshot(ctx context.Context, db *gorm.DB, base config.Config) (config.Config, int64, error) {
	out := base
	var revision int64
	e := db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var err error
		revision, err = PublishedRevision(ctx, tx)
		if err != nil {
			return err
		}
		out, err = LoadPublished(ctx, tx, base)
		return err
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	return out, revision, e
}
