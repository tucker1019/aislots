package recentwins

import (
	"context"
	"sort"
	"sync"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/model"
	"apps/pkg/xlog"
)

type Store interface {
	ReadRecentWins(context.Context, []string, time.Time) ([]model.RecentWinView, error)
}

// Feed is shared by all HTTP requests in one runtime snapshot.
// Requests read memory; a worker aggregates on startup and once per minute.
type replayEntry struct {
	row       model.RecentWinView
	published time.Time
}

type Feed struct {
	mu      sync.RWMutex
	store   Store
	games   []string
	rows    []model.RecentWinView
	replay  map[string]replayEntry
	updated time.Time
}

func New(store Store, games map[string]config.GameEntry) *Feed {
	ids := []string{}
	for id, g := range games {
		if g.Enabled && g.IsVisible() {
			ids = append(ids, id)
		}
	}
	sort.Strings(ids)
	return &Feed{store: store, games: ids, replay: map[string]replayEntry{}}
}

func (f *Feed) Refresh(ctx context.Context, now time.Time) error {
	rows, err := f.store.ReadRecentWins(ctx, f.games, now)
	if err != nil {
		return err
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	for id, entry := range f.replay {
		if entry.published.Before(now.Add(-time.Hour)) {
			delete(f.replay, id)
		}
	}
	for _, row := range rows {
		f.replay[row.ID] = replayEntry{row: row, published: now}
	}
	f.rows = append([]model.RecentWinView(nil), rows...)
	f.updated = now
	return nil
}

func (f *Feed) Snapshot(now time.Time) ([]model.RecentWinView, time.Time) {
	f.mu.RLock()
	defer f.mu.RUnlock()
	out := []model.RecentWinView{}
	for _, row := range f.rows {
		if !row.EndedAt.Before(now.Add(-time.Hour)) && !row.EndedAt.After(now) {
			out = append(out, row)
		}
	}
	return out, f.updated
}

func (f *Feed) Run(ctx context.Context) {
	refresh := func() {
		work, cancel := context.WithTimeout(ctx, 10*time.Second)
		defer cancel()
		if err := f.Refresh(work, time.Now().UTC()); err != nil && ctx.Err() == nil {
			xlog.Error(ctx, "recent wins aggregation failed", "error", err)
		}
	}
	refresh()
	tick := time.NewTicker(time.Minute)
	defer tick.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
			refresh()
		}
	}
}

// Replay retains recently published authorizations across snapshot replacement.
// A card already in a player's current lap must remain replayable after the next refresh.
func (f *Feed) Replay(id string, now time.Time) (model.RecentWinView, bool) {
	f.mu.RLock()
	defer f.mu.RUnlock()
	entry, ok := f.replay[id]
	return entry.row, ok && !entry.published.Before(now.Add(-time.Hour))
}
