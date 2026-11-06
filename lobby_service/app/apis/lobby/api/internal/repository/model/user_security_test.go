package model

import (
	"context"
	"golang.org/x/crypto/bcrypt"
	"testing"
	"time"
)

func TestPasswordChangeRevokesSessionsAndRejectsOldCredential(t *testing.T) {
	db := vipTestDB(t)
	m := &UserModel{DB: db}
	ctx := context.Background()
	now := time.Now().UTC()
	expiry := now.Add(time.Hour)
	hash, _ := bcrypt.GenerateFromPassword([]byte("old-password"), bcrypt.MinCost)
	next, _ := bcrypt.GenerateFromPassword([]byte("new-password"), bcrypt.MinCost)
	uid, err := m.Create(ctx, "security_user", string(hash), "session-one", expiry)
	if err != nil {
		t.Fatal(err)
	}
	if err = m.NewSession(ctx, uid, "session-two", expiry); err != nil {
		t.Fatal(err)
	}
	if err = m.ChangePassword(ctx, uid, "session-one", "wrong", string(next), now); err == nil {
		t.Fatal("wrong password accepted")
	}
	if err = m.Check(ctx, uid, "session-one", now); err != nil {
		t.Fatal("failed change revoked session")
	}
	if err = m.ChangePassword(ctx, uid, "session-one", "old-password", string(next), now); err != nil {
		t.Fatal(err)
	}
	if err = m.Check(ctx, uid, "session-one", now); err == nil {
		t.Fatal("current session survived")
	}
	if err = m.Check(ctx, uid, "session-two", now); err == nil {
		t.Fatal("other session survived")
	}
	if err = m.NewPasswordSession(ctx, uid, string(hash), "stale-login", expiry); err == nil {
		t.Fatal("stale login after password change accepted")
	}
	if err = m.NewPasswordSession(ctx, uid, string(next), "new-login", expiry); err != nil {
		t.Fatal(err)
	}
	if err = m.Logout(ctx, uid, "new-login"); err != nil {
		t.Fatal(err)
	}
	if err = m.Logout(ctx, uid, "new-login"); err != nil {
		t.Fatal("logout retry must succeed", err)
	}
	if err = m.Check(ctx, uid, "new-login", now); err == nil {
		t.Fatal("logged out session survived")
	}
}
