package repository

import (
	"context"
	"time"

	"apps/app/apis/lobby/api/internal/repository/model"
)

//go:generate go run go.uber.org/mock/mockgen -source=mail_type.go -destination=mocks/mock_mail.go -package=mocks

type MailStore interface {
	List(context.Context, int64, string, time.Time, string, int) ([]model.PlayerMail, string, bool, error)
	MarkRead(context.Context, int64, string, time.Time, int64) error
	ReadAll(context.Context, int64, string, time.Time) error
	Delete(context.Context, int64, string, time.Time, int64) error
}
