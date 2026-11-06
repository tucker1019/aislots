package server

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"sync/atomic"
	"time"

	"apps/app/apis/lobby/api/internal/adminconfig"
	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository"
	"apps/app/apis/lobby/api/internal/repository/model"
	"apps/app/apis/lobby/api/internal/router"
	"apps/app/apis/lobby/api/internal/svc"
	"apps/pkg/xlog"
	"gorm.io/gorm"
)

type handlerSnapshot struct{ handler http.Handler }

// LiveHandler changes future requests atomically; active requests retain their dependency snapshot.
type LiveHandler struct {
	current atomic.Pointer[handlerSnapshot]
}

func (h *LiveHandler) Store(v http.Handler) { h.current.Store(&handlerSnapshot{v}) }
func (h *LiveHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	v := h.current.Load()
	if v == nil {
		http.Error(w, "service starting", http.StatusServiceUnavailable)
		return
	}
	v.handler.ServeHTTP(w, r)
}

type Runtime struct {
	LiveHandler
	cancel context.CancelFunc
	done   chan struct{}
}

func (r *Runtime) Close() { r.cancel(); <-r.done }
func buildDependencies(ctx context.Context, db *gorm.DB, c config.Config) (*svc.ServiceContext, error) {
	if e := (&model.TurnoverModel{DB: db}).Configure(ctx, c.Turnover); e != nil {
		return nil, e
	}
	repo := repository.New(db, c.Checkin.Location())
	repo.ConfigureVIP(db, c.VIP, c.Checkin.Location())
	repo.ConfigureNewbie(db, c.Newbie)
	repo.ConfigureInvite(db, c.Invite)
	repo.ConfigureAgent(db, c.Agent, c.Game.Games, c.Checkin.Location())
	return svc.New(c, repo), nil
}
func startWorkers(ctx context.Context, db *gorm.DB, d *svc.ServiceContext) func() {
	worker, cancel := context.WithCancel(ctx)
	done := []<-chan struct{}{StartPayments(worker, d.Repo.Recharge), StartVIP(worker, d.Repo.VIP), StartAgent(worker, d.Repo.Agent), StartExperience(worker, d.Config, db)}
	return func() {
		cancel()
		for _, v := range done {
			<-v
		}
	}
}

// NewRuntime owns the listener's immutable configuration snapshot and version watcher.
func NewRuntime(parent context.Context, db *gorm.DB, base config.Config) (*Runtime, error) {
	if e := adminconfig.Seed(parent, db, base); e != nil {
		return nil, e
	}
	c, revision, e := adminconfig.LoadSnapshot(parent, db, base)
	if e != nil {
		return nil, e
	}
	d, e := buildDependencies(parent, db, c)
	if e != nil {
		return nil, e
	}
	ctx, cancel := context.WithCancel(parent)
	r := &Runtime{cancel: cancel, done: make(chan struct{})}
	r.Store(router.New(d))
	host, _ := os.Hostname()
	instance := fmt.Sprintf("%s:%d", host, os.Getpid())
	store := model.AdminConfigStore{DB: db}
	stopWorkers := startWorkers(ctx, db, d)
	if e = store.RecordRuntime(ctx, instance, revision, ""); e != nil {
		stopWorkers()
		cancel()
		return nil, e
	}
	go func() {
		defer close(r.done)
		defer func() { stopWorkers() }()
		tick := time.NewTicker(2 * time.Second)
		defer tick.Stop()
		heartbeat := time.NewTicker(30 * time.Second)
		defer heartbeat.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-heartbeat.C:
				if er := store.RecordRuntime(ctx, instance, revision, ""); er != nil && ctx.Err() == nil {
					xlog.Error(ctx, "configuration runtime heartbeat failed", "error", er)
				}
			case <-tick.C:
				next, er := adminconfig.PublishedRevision(ctx, db)
				if er != nil {
					if ctx.Err() == nil {
						xlog.Error(ctx, "configuration revision check failed", "error", er)
					}
					continue
				}
				if next == revision {
					continue
				}
				c, next, er = adminconfig.LoadSnapshot(ctx, db, base)
				var updated *svc.ServiceContext
				if er == nil {
					updated, er = buildDependencies(ctx, db, c)
				}
				if er != nil {
					if ctx.Err() == nil {
						xlog.Error(ctx, "published configuration not applied; keeping previous snapshot", "error", er)
						_ = store.RecordRuntime(ctx, instance, revision, "配置应用失败，已保留旧快照；请检查大厅服务日志")
					}
					continue
				}
				if ctx.Err() != nil {
					return
				}
				stopWorkers()
				r.Store(router.New(updated))
				stopWorkers = startWorkers(ctx, db, updated)
				revision = next
				if er = store.RecordRuntime(ctx, instance, revision, ""); er != nil && ctx.Err() == nil {
					xlog.Error(ctx, "configuration runtime status failed", "error", er)
				}
				xlog.Info(ctx, "published lobby configuration applied", "revision", revision)
			}
		}
	}()
	return r, nil
}
