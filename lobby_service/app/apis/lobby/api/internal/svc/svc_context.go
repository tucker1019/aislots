package svc

import (
	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/manager/recentwins"
	"apps/app/apis/lobby/api/internal/repository"
)

type ServiceContext struct {
	Config     config.Config
	Repo       *repository.Repository
	RecentWins *recentwins.Feed
}

func New(c config.Config, r *repository.Repository) *ServiceContext {
	s := &ServiceContext{Config: c, Repo: r}
	if store, ok := r.Game.(recentwins.Store); ok {
		s.RecentWins = recentwins.New(store, c.Game.Games)
	}
	return s
}
