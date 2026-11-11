package model

import (
	"context"
	"testing"
	"time"
)

func TestExperiencePoolLifecycle(t *testing.T) {
	db := vipTestDB(t)
	m := ExperienceModel{DB: db}
	ctx := context.Background()
	now := time.Now().Add(time.Second)
	create := func(at time.Time) {
		t.Helper()
		if e := m.CreateScheduled(ctx, at, 100000, 10, 1, "AG1", "CN", "CNY", 30*time.Second); e != nil {
			t.Fatal(e)
		}
	}
	create(now)
	create(now)
	var count int64
	db.Table("lobby_experience_accounts").Count(&count)
	if count != 1 {
		t.Fatal(count)
	}
	create(now.Add(31 * time.Second))
	db.Table("lobby_experience_accounts").Count(&count)
	if count != 2 {
		t.Fatal(count)
	}
	jobs, e := m.DueJobs(ctx, true, now.Add(time.Minute))
	if e != nil || len(jobs) != 2 {
		t.Fatal(jobs, e)
	}
	j := jobs[0]
	if e = m.BeginJob(ctx, &j, 20); e != nil || j.RequestID == "" {
		t.Fatal(j, e)
	}
	pending, e := m.DueJobs(ctx, false, now.Add(time.Minute))
	if e != nil || len(pending) != 1 || pending[0].RequestID != j.RequestID {
		t.Fatal(pending, e)
	}
	if e = m.FinishJob(ctx, j, "bet-test", time.Hour, true); e != nil {
		t.Fatal(e)
	}
	if e = m.FinishJob(ctx, j, "bet-test", time.Hour, true); e != nil {
		t.Fatal(e)
	}
	var rounds int
	db.Raw("SELECT rounds FROM lobby_experience_accounts WHERE id=?", j.ID).Scan(&rounds)
	if rounds != 1 {
		t.Fatal(rounds)
	}
	j = jobs[1]
	db.Exec("UPDATE lobby_wallet_balances SET coins=0 WHERE uid=?", j.UID)
	if e = m.BeginJob(ctx, &j, 20); e != nil || j.RequestID != "" {
		t.Fatal(j, e)
	}
	left, e := m.DueJobs(ctx, true, now.Add(time.Hour))
	if e != nil || len(left) != 0 {
		t.Fatal(left, e)
	}
}

func TestExperienceAccountKeepsSelectedGame(t *testing.T) {
	db := vipTestDB(t)
	m := ExperienceModel{DB: db}
	ctx := context.Background()
	now := time.Now().Add(time.Second)
	if err := m.CreateScheduled(ctx, now, 100000, 10, 1, "AG2", "ID", "IDR", time.Minute); err != nil {
		t.Fatal(err)
	}
	jobs, err := m.DueJobs(ctx, true, now)
	if err != nil || len(jobs) != 1 || jobs[0].GameID != "AG2" {
		t.Fatal(jobs, err)
	}
	if err = m.BeginJob(ctx, &jobs[0], 20); err != nil {
		t.Fatal(err)
	}
	pending, err := m.DueJobs(ctx, false, now)
	if err != nil || len(pending) != 1 || pending[0].GameID != "AG2" || pending[0].RequestID != jobs[0].RequestID {
		t.Fatal("pending request lost binding", pending, err)
	}
	if err = db.Exec("UPDATE lobby_experience_accounts SET game_id='AG1' WHERE id=?", jobs[0].ID).Error; err == nil {
		t.Fatal("game reassignment must be rejected")
	}
	if err = m.FinishJob(ctx, jobs[0], "settled", time.Minute, false); err != nil {
		t.Fatal(err)
	}
	again, err := m.DueJobs(ctx, true, now.Add(time.Hour))
	if err != nil || len(again) != 1 || again[0].GameID != "AG2" {
		t.Fatal(again, err)
	}
}
