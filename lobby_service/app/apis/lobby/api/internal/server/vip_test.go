package server

import (
	"context"
	"errors"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/repository/mocks"

	"go.uber.org/mock/gomock"
)

func TestVIPWorkerRetryAndStop(t *testing.T) {
	store := mocks.NewMockVIPStore(gomock.NewController(t))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	calls := 0
	store.EXPECT().TickVIP(gomock.Any(), gomock.Any()).DoAndReturn(func(context.Context, time.Time) error {
		calls++
		if calls == 1 {
			return errors.New("temporary")
		}
		cancel()
		return nil
	}).Times(2)
	done := StartVIP(ctx, store)
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("worker did not stop")
	}
}
