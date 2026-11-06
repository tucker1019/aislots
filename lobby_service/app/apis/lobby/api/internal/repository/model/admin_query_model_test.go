package model

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestAdminOverviewActivityDay(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	uid, e := (&UserModel{DB: db}).Create(ctx, "", "", "overview-timezone", time.Now().Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	times := []time.Time{time.Date(2026, 6, 10, 16, 59, 59, 0, time.UTC), time.Date(2026, 6, 10, 17, 0, 0, 0, time.UTC), time.Date(2026, 6, 11, 16, 59, 59, 0, time.UTC), time.Date(2026, 6, 11, 17, 0, 0, 0, time.UTC)}
	for i, settled := range times {
		id := string(rune('a' + i))
		if e = db.Create(&LobbyRechargeOrder{OrderID: id, UID: uid, RequestID: id, TierID: "test", Amount: int64(i+1) * 100, CreditAmount: int64(i+1) * 100, Coins: int64(i+1) * 100, Status: "success", SettledAt: &settled, CreatedAt: settled, SettleAt: settled}).Error; e != nil {
			t.Fatal(e)
		}
		if e = db.Create(&LobbyWithdrawalOrder{OrderID: id, UID: uid, RequestID: id, TierID: "test", Channel: "test1", Account: "test", Name: "test", Amount: int64(i+1) * 200, Status: "success", SettledAt: &settled, CreatedAt: settled}).Error; e != nil {
			t.Fatal(e)
		}
	}
	loc, _ := time.LoadLocation("Asia/Jakarta")
	v, e := (AdminQueryModel{DB: db}).Overview(ctx, time.Date(2026, 6, 11, 0, 30, 0, 0, time.UTC), loc)
	if e != nil {
		t.Fatal(e)
	}
	if v.TodayDeposits != "500" || v.TodayWithdrawals != "1000" || v.Members != 1 {
		t.Fatalf("activity day totals %+v", v)
	}
}
func TestAdminQueriesHonorCancelledContext(t *testing.T) {
	db := vipTestDB(t)
	q := AdminQueryModel{DB: db}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, e := q.Overview(ctx, time.Now(), nil); !errors.Is(e, context.Canceled) {
		t.Fatalf("overview cancellation %v", e)
	}
	if _, e := q.Members(ctx, AdminListCriteria{Limit: 20}); !errors.Is(e, context.Canceled) {
		t.Fatalf("members cancellation %v", e)
	}
	if _, e := q.Member(ctx, 1); !errors.Is(e, context.Canceled) {
		t.Fatalf("member cancellation %v", e)
	}
	if _, e := q.Orders(ctx, AdminOrderCriteria{Kind: "deposit", Limit: 20}); !errors.Is(e, context.Canceled) {
		t.Fatalf("orders cancellation %v", e)
	}
	if _, e := q.Audit(ctx, AdminListCriteria{Limit: 20}); !errors.Is(e, context.Canceled) {
		t.Fatalf("audit cancellation %v", e)
	}
}
