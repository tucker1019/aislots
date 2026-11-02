package svc

import (
	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository"
)

type ServiceContext struct {
	Config config.Config
	Repo   *repository.Repository
}

func New(c config.Config, r *repository.Repository) *ServiceContext {
	return &ServiceContext{Config: c, Repo: r}
}
