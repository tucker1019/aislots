package userservice

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/api/v1"

	"go.uber.org/mock/gomock"
)

type withdrawalFake struct {
	err       error
	remaining int64
	rows      []model.CashOrderRow
	seenTier  *config.RechargeTier
	seenToken string
}

func (f *withdrawalFake) Remaining(context.Context, int64) (int64, error) { return f.remaining, f.err }
func (f *withdrawalFake) Create(_ context.Context, _ int64, token, _, _, _ string, tier *config.RechargeTier) (*model.LobbyWithdrawalOrder, error) {
	f.seenTier = tier
	f.seenToken = token
	return f.order(), f.err
}

func (f *withdrawalFake) Review(context.Context, int64, string, string, string) (*model.LobbyWithdrawalOrder, error) {
	return f.order(), f.err
}

func (f *withdrawalFake) Info(context.Context, int64, string) (*model.LobbyWithdrawalOrder, error) {
	return f.order(), f.err
}

func (f *withdrawalFake) CashOrders(context.Context, int64, string, time.Time, time.Time, time.Time, string) ([]model.CashOrderRow, error) {
	return f.rows, f.err
}

func (f *withdrawalFake) order() *model.LobbyWithdrawalOrder {
	now := time.Now().UTC()
	return &model.LobbyWithdrawalOrder{OrderID: "wdr_test", Amount: 5000, Fee: 100, SettledAt: &now, CreatedAt: now}
}

func TestWithdrawalTurnoverAndRequestReplies(t *testing.T) {
	s, m := setup(t)
	ctx := context.Background()
	r := request()
	m.EXPECT().Check(ctx, r.GetUid(), Hash(r.GetSid()), gomock.Any()).Return(nil).AnyTimes()
	f := &withdrawalFake{}
	s.Withdrawal = f
	s.WithdrawalTestMode = true
	s.WithdrawalTiers = []config.RechargeTier{{ID: "tier", Amount: 5000}}
	gate, e := s.WithdrawalTurnover(ctx, r)
	if e != nil || !gate.CanWithdraw || gate.Remaining != 0 {
		t.Fatal(gate, e)
	}
	f.remaining = 126000
	gate, e = s.WithdrawalTurnover(ctx, r)
	if e != nil || gate.CanWithdraw || gate.Remaining != 126000 {
		t.Fatal(gate, e)
	}
	wr := &pb.WithdrawalRequest{Uid: r.Uid, Sid: r.Sid, RequestId: "stable-withdrawal-id", TierId: "tier", Channel: "test1", OrderId: "wdr_test", Decision: "approve", From: "2026-11-01T00:00:00Z", To: "2026-11-05T00:00:00Z"}
	order, e := s.WithdrawalCreate(ctx, wr)
	if e != nil || order.CreditAmount != 4900 || order.SettledAt == "" || f.seenTier == nil || f.seenToken != Hash(r.GetSid()) {
		t.Fatal(order, e)
	}
	if _, e = s.WithdrawalInfo(ctx, wr); e != nil {
		t.Fatal(e)
	}
	if _, e = s.WithdrawalReview(ctx, wr); e != nil {
		t.Fatal(e)
	}
	settled := time.Now().UTC()
	for i := 0; i < 21; i++ {
		f.rows = append(f.rows, model.CashOrderRow{OrderID: "order", Kind: "withdrawal", Amount: 5000, CreatedAt: settled, SettledAt: &settled})
	}
	list, e := s.CashOrders(ctx, wr)
	if e != nil || len(list.Items) != 20 || list.NextCursor == "" || list.Items[0].SettledAt == "" {
		t.Fatal(list, e)
	}
	wr.Cursor = list.NextCursor
	if _, e = s.CashOrders(ctx, wr); e != nil {
		t.Fatal(e)
	}
	wr.Cursor = ""
	wr.OrderId = strings.Repeat("x", 129)
	if _, e = s.WithdrawalInfo(ctx, wr); e == nil {
		t.Fatal("oversize order id")
	}
	if _, e = s.WithdrawalReview(ctx, wr); e == nil {
		t.Fatal("oversize review id")
	}
	wr.OrderId = "wdr_test"
	f.err = errors.New("db")
	if _, e = s.WithdrawalTurnover(ctx, r); e == nil {
		t.Fatal("turnover failure masked")
	}
	if _, e = s.WithdrawalCreate(ctx, wr); e == nil {
		t.Fatal("create failure")
	}
	if _, e = s.WithdrawalInfo(ctx, wr); e == nil {
		t.Fatal("info failure")
	}
	if _, e = s.WithdrawalReview(ctx, wr); e == nil {
		t.Fatal("review failure")
	}
	if _, e = s.CashOrders(ctx, wr); e == nil {
		t.Fatal("cash failure")
	}
}
