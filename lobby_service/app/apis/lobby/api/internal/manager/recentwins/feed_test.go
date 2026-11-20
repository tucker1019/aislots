package recentwins

import (
	"context"
	"errors"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/model"
)

type fakeStore struct {
	rows   []model.RecentWinView
	err    error
	games  []string
	called chan struct{}
}

func (s *fakeStore) ReadRecentWins(_ context.Context, games []string, _ time.Time) ([]model.RecentWinView, error) {
	s.games = append([]string(nil), games...)
	if s.called != nil {
		s.called <- struct{}{}
	}
	return s.rows, s.err
}

func TestSnapshotExpiryIsolationAndFailedRefresh(t *testing.T) {
	now := time.Now().UTC()
	hidden := false
	s := &fakeStore{rows: []model.RecentWinView{{ID: "1", EndedAt: now.Add(-time.Minute)}, {ID: "2", EndedAt: now.Add(-time.Hour)}, {ID: "3", EndedAt: now.Add(time.Second)}}}
	f := New(s, map[string]config.GameEntry{"AG1": {Enabled: true}, "hidden": {Enabled: true, Visible: &hidden}, "disabled": {}})
	if err := f.Refresh(context.Background(), now); err != nil {
		t.Fatal(err)
	}
	if len(s.games) != 1 || s.games[0] != "AG1" {
		t.Fatal(s.games)
	}
	rows, updated := f.Snapshot(now)
	if len(rows) != 2 || !updated.Equal(now) {
		t.Fatal(rows, updated)
	}
	rows[0].ID = "mutated"
	s.rows[0].ID = "mutated input"
	rows, _ = f.Snapshot(now)
	if rows[0].ID != "1" {
		t.Fatal(rows)
	}
	s.err = errors.New("offline")
	if f.Refresh(context.Background(), now.Add(time.Minute)) == nil {
		t.Fatal("error lost")
	}
	rows, updated = f.Snapshot(now.Add(time.Second))
	if len(rows) != 2 || rows[0].ID != "1" || !updated.Equal(now) {
		t.Fatal(rows, updated)
	}
	rows, _ = f.Snapshot(now.Add(time.Hour + 2*time.Second))
	if len(rows) != 0 {
		t.Fatal(rows)
	}
}

func TestRunRefreshesOnStartupAndStops(t *testing.T) {
	s := &fakeStore{called: make(chan struct{}, 1)}
	f := New(s, nil)
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { defer close(done); f.Run(ctx) }()
	select {
	case <-s.called:
	case <-time.After(time.Second):
		t.Fatal("missing startup refresh")
	}
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("worker did not stop")
	}
}

func TestReplaySurvivesReplacementAndEventuallyExpires(t *testing.T) {
	now := time.Now().UTC()
	s := &fakeStore{rows: []model.RecentWinView{{ID: "1", EndedAt: now.Add(-time.Minute)}}}
	f := New(s, nil)
	if err := f.Refresh(context.Background(), now); err != nil {
		t.Fatal(err)
	}
	s.rows = nil
	if err := f.Refresh(context.Background(), now.Add(time.Minute)); err != nil {
		t.Fatal(err)
	}
	if rows, _ := f.Snapshot(now.Add(time.Minute)); len(rows) != 0 {
		t.Fatal(rows)
	}
	if row, ok := f.Replay("1", now.Add(2*time.Minute)); !ok || row.ID != "1" {
		t.Fatal("replay lost after refresh", row, ok)
	}
	if _, ok := f.Replay("2", now); ok {
		t.Fatal("unpublished order accepted")
	}
	if _, ok := f.Replay("1", now.Add(time.Hour+time.Second)); ok {
		t.Fatal("expired replay accepted")
	}
	if err := f.Refresh(context.Background(), now.Add(time.Hour+time.Second)); err != nil {
		t.Fatal(err)
	}
	if len(f.replay) != 0 {
		t.Fatal("expired authorization leaked")
	}
}
