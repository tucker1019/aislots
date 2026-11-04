package model

import (
	"context"
	"testing"
	"time"

	migrations "apps/deploy/migration"
)

func TestBindingSetsAccountAndNicknameAtomically(t *testing.T) {
	db := vipTestDB(t)
	users := &UserModel{DB: db}
	ctx := context.Background()
	now := time.Now().UTC()
	uid, err := users.Create(ctx, "", "", "profile-session", now.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	before, err := users.Profile(ctx, uid, "profile-session", now)
	if err != nil || before.Account != "" {
		t.Fatal(before, err)
	}
	if err = users.Bind(ctx, uid, "profile-session", "custom_user", "hash", now, now.Add(time.Hour)); err != nil {
		t.Fatal(err)
	}
	after, err := users.Profile(ctx, uid, "profile-session", now)
	if err != nil || after.Account != "custom_user" || after.Nickname != "custom_user" || after.AvatarID != before.AvatarID {
		t.Fatal(after, err)
	}
	other, err := users.Create(ctx, "", "", "other-session", now.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if err = users.Bind(ctx, other, "other-session", "custom_user", "hash", now, now.Add(time.Hour)); err == nil {
		t.Fatal("duplicate binding accepted")
	}
	unchanged, err := users.Profile(ctx, other, "other-session", now)
	if err != nil || unchanged.Account != "" || unchanged.Nickname == "custom_user" {
		t.Fatal("conflicting binding changed profile", unchanged, err)
	}
}

func TestLegacyDefaultNicknameMigrationIsIdempotent(t *testing.T) {
	db := vipTestDB(t)
	users := &UserModel{DB: db}
	ctx := context.Background()
	now := time.Now().UTC()
	uid, err := users.Create(ctx, "legacy_account", "hash", "legacy-session", now.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	profile, err := users.Profile(ctx, uid, "legacy-session", now)
	if err != nil || profile.Nickname != "legacy_account" {
		t.Fatal("registered account nickname", profile, err)
	}
	if err = db.Exec("UPDATE lobby_users SET nickname='player_' || uid::text WHERE uid=?", uid).Error; err != nil {
		t.Fatal(err)
	}
	custom, err := users.Create(ctx, "other_account", "hash", "custom-session", now.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if err = db.Exec("UPDATE lobby_users SET nickname='my custom name' WHERE uid=?", custom).Error; err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if err = db.Exec(migrations.Schema).Error; err != nil {
			t.Fatal(err)
		}
	}
	profile, err = users.Profile(ctx, uid, "legacy-session", now)
	if err != nil || profile.Nickname != "legacy_account" {
		t.Fatal("legacy nickname not repaired", profile, err)
	}
	profile, err = users.Profile(ctx, custom, "custom-session", now)
	if err != nil || profile.Nickname != "my custom name" {
		t.Fatal("custom nickname overwritten", profile, err)
	}
}
