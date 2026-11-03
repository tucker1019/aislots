package model

import (
	"context"
	"strings"
	"testing"
	"time"
)

func TestRechargeDateRangeIsHalfOpenAndUserScoped(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	now := time.Now().UTC().Truncate(time.Microsecond)
	token := strings.Repeat("t", 64)
	uid, e := (&UserModel{DB: db}).Create(ctx, "", "", token, now.Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	start := now.Add(-time.Hour)
	end := now.Add(time.Hour)
	for i, at := range []time.Time{start.Add(-time.Second), start, end.Add(-time.Second), end} {
		o := LobbyRechargeOrder{OrderID: []string{"before", "start", "inside", "end"}[i], UID: uid, RequestID: []string{"a", "b", "c", "d"}[i], TierID: "tier", Amount: 100, Bonus: 0, Fee: 0, CreditAmount: 100, Status: "success", CreatedAt: at, SettleAt: at}
		if e = db.Create(&o).Error; e != nil {
			t.Fatal(e)
		}
	}
	records, e := (&RechargeModel{DB: db}).ReadRechargeOrders(ctx, uid, token, OrderQuery{From: start, To: end, Limit: 20}, now)
	if e != nil || len(records) != 2 || records[0].OrderID != "inside" || records[1].OrderID != "start" {
		t.Fatal(records, e)
	}
	if _, e = (&RechargeModel{DB: db}).ReadRechargeOrders(ctx, uid, "wrong", OrderQuery{From: start, To: end, Limit: 20}, now); e == nil {
		t.Fatal("unauthorized history read")
	}
}
