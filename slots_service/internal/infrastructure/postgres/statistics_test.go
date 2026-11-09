package postgres

import (
	"aislots/slots_service/internal/infrastructure/lobby"
	"context"
	"testing"
	"time"
)

func TestStatisticsBatchStopsAtBudgetWithoutError(t *testing.T) {
	// A stopped batch must return before attempting to acquire a connection.
	store := &Store{lobby: &lobby.Client{}}
	if err := store.flushStatistics(context.Background(), time.Now().Add(-time.Second)); err != nil {
		t.Fatal(err)
	}
}
