package repository

import (
	"context"
	"time"

	"apps/app/apis/lobby/api/internal/repository/model"
)

//go:generate go run go.uber.org/mock/mockgen -source=agent_type.go -destination=mocks/mock_agent.go -package=mocks
type AgentStore interface {
	Query(context.Context, model.AgentQuery, time.Time) (*model.AgentView, error)
	Claim(context.Context, int64, string, time.Time) (*model.LobbyAgentClaim, error)
	Tick(context.Context, time.Time) error
}
