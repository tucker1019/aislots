package model

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func configIdentity(_ AdminConfigRow, doc json.RawMessage, _ int64) (json.RawMessage, error) {
	return doc, nil
}
func TestAdminConfigSeedAndConcurrentDraft(t *testing.T) {
	db := vipTestDB(t)
	s := AdminConfigStore{DB: db}
	ctx := context.Background()
	if e := s.Seed(ctx, "test", json.RawMessage(`{"value":1}`)); e != nil {
		t.Fatal(e)
	}
	var wins atomic.Int32
	var wg sync.WaitGroup
	for range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			e := s.Draft(ctx, "test", 1, json.RawMessage(`{"value":2}`), "operator", "draft")
			if e == nil {
				wins.Add(1)
			} else if !errors.Is(e, ErrAdminConfigConflict) {
				t.Error(e)
			}
		}()
	}
	wg.Wait()
	if wins.Load() != 1 {
		t.Fatalf("draft winners %d", wins.Load())
	}
	if e := s.Seed(ctx, "test", json.RawMessage(`{"value":99}`)); e != nil {
		t.Fatal(e)
	}
	r, e := s.Get(ctx, "test", false)
	if e != nil {
		t.Fatal(e)
	}
	if r.Version != 2 || r.PublishedVersion != 1 || r.DraftVersion != 2 || string(r.Published) != `{"value": 1}` || string(r.Draft) != `{"value": 2}` {
		t.Fatalf("seed overwrote existing state: %+v", r)
	}
	history, e := s.History(ctx, "test")
	if e != nil || len(history) != 2 {
		t.Fatalf("history %d %v", len(history), e)
	}
	var n int64
	db.Table("lobby_admin_audits").Count(&n)
	if n != 1 {
		t.Fatalf("draft audits %d", n)
	}
}

func TestAdminConfigPublishReplayRollback(t *testing.T) {
	db := vipTestDB(t)
	s := AdminConfigStore{DB: db}
	ctx := context.Background()
	must := func(e error) {
		t.Helper()
		if e != nil {
			t.Fatal(e)
		}
	}
	must(s.Seed(ctx, "test", json.RawMessage(`{"value":1}`)))
	must(s.Draft(ctx, "test", 1, json.RawMessage(`{"value":2}`), "operator", "draft"))
	must(s.Publish(ctx, "test", 2, 0, "publish-1", "fingerprint-1", "admin", "publish", configIdentity))
	r, e := s.Get(ctx, "test", false)
	must(e)
	if r.PublishedVersion != 2 || r.DraftVersion != 0 || len(r.Draft) != 0 {
		t.Fatalf("publish retained draft %+v", r)
	}
	must(s.Seed(ctx, "test", json.RawMessage(`{"value":99}`)))
	r, e = s.Get(ctx, "test", false)
	must(e)
	if r.PublishedVersion != 2 || string(r.Published) != `{"value": 2}` {
		t.Fatalf("seed overwrote published %+v", r)
	}
	called := false
	must(s.Publish(ctx, "test", 2, 0, "publish-1", "fingerprint-1", "admin", "publish", func(AdminConfigRow, json.RawMessage, int64) (json.RawMessage, error) {
		called = true
		return nil, errors.New("must not transform replay")
	}))
	if called {
		t.Fatal("replay transformed document")
	}
	if e = s.Publish(ctx, "test", 2, 0, "publish-1", "changed", "admin", "changed", configIdentity); !errors.Is(e, ErrAdminConfigConflict) {
		t.Fatalf("fingerprint conflict %v", e)
	}
	if e = s.Publish(ctx, "test", 0, 0, "no-draft", "no-draft", "admin", "publish", configIdentity); !errors.Is(e, ErrAdminConfigConflict) {
		t.Fatalf("missing draft should conflict: %v", e)
	}
	var releases, audits int64
	must(db.Table("lobby_admin_config_releases").Count(&releases).Error)
	must(db.Table("lobby_admin_audits").Count(&audits).Error)
	if releases != 1 || audits != 2 {
		t.Fatalf("duplicate receipt/audit %d/%d", releases, audits)
	}
	must(s.Draft(ctx, "test", 2, json.RawMessage(`{"value":3}`), "operator", "pending draft"))
	must(s.Publish(ctx, "test", 2, 1, "rollback-1", "rollback-fingerprint", "admin", "rollback", configIdentity))
	r, e = s.Get(ctx, "test", false)
	must(e)
	if r.Version != 4 || r.PublishedVersion != 4 || r.DraftVersion != 0 || len(r.Draft) != 0 || string(r.Published) != `{"value": 1}` {
		t.Fatalf("rollback reused history or retained draft %+v", r)
	}
	v, e := s.Version(ctx, "test", 1)
	must(e)
	if v.Status != "superseded" {
		t.Fatalf("historical version mutated %s", v.Status)
	}
	v, e = s.Version(ctx, "test", 4)
	must(e)
	if v.Status != "published" {
		t.Fatalf("rollback new version status %s", v.Status)
	}
	must(s.Publish(ctx, "test", 2, 1, "rollback-1", "rollback-fingerprint", "admin", "rollback", configIdentity))
	must(db.Table("lobby_admin_config_releases").Count(&releases).Error)
	if releases != 2 {
		t.Fatalf("rollback replay duplicated receipt %d", releases)
	}
}

func TestAdminConfigPublishAuditRollback(t *testing.T) {
	db := vipTestDB(t)
	s := AdminConfigStore{DB: db}
	ctx := context.Background()
	if e := s.Seed(ctx, "test", json.RawMessage(`{"value":1}`)); e != nil {
		t.Fatal(e)
	}
	if e := s.Draft(ctx, "test", 1, json.RawMessage(`{"value":2}`), "operator", "draft"); e != nil {
		t.Fatal(e)
	}
	if e := db.Exec("ALTER TABLE lobby_admin_audits ADD CONSTRAINT reject_publish CHECK(action <> 'config.publish') NOT VALID").Error; e != nil {
		t.Fatal(e)
	}
	if e := s.Publish(ctx, "test", 2, 0, "fail-publish", "fp", "admin", "publish", configIdentity); e == nil {
		t.Fatal("expected audit rejection")
	}
	r, e := s.Get(ctx, "test", false)
	if e != nil {
		t.Fatal(e)
	}
	if r.PublishedVersion != 1 || r.Version != 2 || r.DraftVersion != 2 || string(r.Published) != `{"value": 1}` || string(r.Draft) != `{"value": 2}` {
		t.Fatalf("non atomic publish %+v", r)
	}
	var n int64
	db.Table("lobby_admin_config_releases").Count(&n)
	if n != 0 {
		t.Fatalf("failed publish receipt %d", n)
	}
	v, e := s.Version(ctx, "test", 1)
	if e != nil || v.Status != "published" {
		t.Fatalf("old status %s %v", v.Status, e)
	}
	history, e := s.History(ctx, "test")
	if e != nil || len(history) != 2 || history[0].Status != "draft" {
		t.Fatalf("draft history did not roll back %+v %v", history, e)
	}
}

func TestAdminConfigPublishConcurrentAndValidation(t *testing.T) {
	db := vipTestDB(t)
	s := AdminConfigStore{DB: db}
	ctx := context.Background()
	if e := s.Seed(ctx, "test", json.RawMessage(`{"value":1}`)); e != nil {
		t.Fatal(e)
	}
	if e := s.Draft(ctx, "test", 1, json.RawMessage(`{"value":2}`), "operator", "draft"); e != nil {
		t.Fatal(e)
	}
	rejected := errors.New("validation rejected")
	if e := s.Publish(ctx, "test", 2, 0, "invalid", "fp-invalid", "admin", "publish", func(AdminConfigRow, json.RawMessage, int64) (json.RawMessage, error) { return nil, rejected }); !errors.Is(e, rejected) {
		t.Fatalf("validation %v", e)
	}
	var wins atomic.Int32
	var wg sync.WaitGroup
	for i := range 8 {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			request := string(rune('a' + i))
			e := s.Publish(ctx, "test", 2, 0, request, request, "admin", "concurrent publish", configIdentity)
			if e == nil {
				wins.Add(1)
			} else if !errors.Is(e, ErrAdminConfigConflict) {
				t.Error(e)
			}
		}(i)
	}
	wg.Wait()
	if wins.Load() != 1 {
		t.Fatalf("publish winners %d", wins.Load())
	}
	var n int64
	db.Table("lobby_admin_config_releases").Count(&n)
	if n != 1 {
		t.Fatalf("publish receipts %d", n)
	}
}

// The first publication stays uncommitted while another section tries to publish.
// Release IDs must follow commit order so polling MAX(id) cannot miss a release.
func TestAdminConfigCrossSectionCommitOrder(t *testing.T) {
	db := vipTestDB(t)
	s := AdminConfigStore{DB: db}
	ctx := context.Background()
	for _, key := range []string{"a", "b"} {
		if e := s.Seed(ctx, key, json.RawMessage(`{"value":1}`)); e != nil {
			t.Fatal(e)
		}
		if e := s.Draft(ctx, key, 1, json.RawMessage(`{"value":2}`), "operator", "draft"); e != nil {
			t.Fatal(e)
		}
	}
	first := db.Begin()
	if first.Error != nil {
		t.Fatal(first.Error)
	}
	defer first.Rollback()
	if e := (AdminConfigStore{DB: first}).Publish(ctx, "a", 2, 0, "publish-a", "fp-a", "admin", "publish", configIdentity); e != nil {
		t.Fatal(e)
	}
	done := make(chan error, 1)
	go func() { done <- s.Publish(ctx, "b", 2, 0, "publish-b", "fp-b", "admin", "publish", configIdentity) }()
	select {
	case e := <-done:
		t.Fatalf("second section committed before first publication: %v", e)
	case <-time.After(150 * time.Millisecond):
	}
	revision, e := s.Revision(ctx)
	if e != nil || revision != 0 {
		t.Fatalf("uncommitted publication visible %d %v", revision, e)
	}
	if e = first.Commit().Error; e != nil {
		t.Fatal(e)
	}
	select {
	case e = <-done:
		if e != nil {
			t.Fatal(e)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("second publisher stayed blocked")
	}
	var releases []AdminConfigRelease
	if e = db.Order("id").Find(&releases).Error; e != nil {
		t.Fatal(e)
	}
	if len(releases) != 2 || releases[0].Section != "a" || releases[1].Section != "b" {
		t.Fatalf("release order %+v", releases)
	}
	revision, e = s.Revision(ctx)
	if e != nil || revision != releases[1].ID {
		t.Fatalf("revision %d %v", revision, e)
	}
}

func TestAdminConfigDraftRejectsStaleVersionAfterPublish(t *testing.T) {
	db := vipTestDB(t)
	s := AdminConfigStore{DB: db}
	ctx := context.Background()
	if e := s.Seed(ctx, "test", json.RawMessage(`{"value":1}`)); e != nil {
		t.Fatal(e)
	}
	// Editor A sees revision 1; another editor publishes revision 2.
	if e := s.Draft(ctx, "test", 1, json.RawMessage(`{"value":2}`), "operator-b", "other draft"); e != nil {
		t.Fatal(e)
	}
	if e := s.Publish(ctx, "test", 2, 0, "aba-publish", "aba-fingerprint", "admin", "publish", configIdentity); e != nil {
		t.Fatal(e)
	}
	if e := s.Draft(ctx, "test", 1, json.RawMessage(`{"value":99}`), "operator-a", "stale draft"); !errors.Is(e, ErrAdminConfigConflict) {
		t.Fatalf("stale revision accepted after cleared draft: %v", e)
	}
	r, e := s.Get(ctx, "test", false)
	if e != nil {
		t.Fatal(e)
	}
	if r.Version != 2 || r.DraftVersion != 0 || len(r.Draft) != 0 {
		t.Fatalf("stale editor mutated state %+v", r)
	}
	if e = s.Draft(ctx, "test", 2, json.RawMessage(`{"value":3}`), "operator-a", "fresh draft"); e != nil {
		t.Fatal(e)
	}
	r, e = s.Get(ctx, "test", false)
	if e != nil {
		t.Fatal(e)
	}
	if r.Version != 3 || r.DraftVersion != 3 || r.PublishedVersion != 2 {
		t.Fatalf("fresh revision not accepted %+v", r)
	}
	var n int64
	if e = db.Table("lobby_admin_audits").Count(&n).Error; e != nil {
		t.Fatal(e)
	}
	if n != 3 {
		t.Fatalf("stale draft wrote audit: %d", n)
	}
}
