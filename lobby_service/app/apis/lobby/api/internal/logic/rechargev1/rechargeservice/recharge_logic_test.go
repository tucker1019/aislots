package rechargeservice

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository"
	"apps/app/apis/lobby/api/internal/repository/mocks"
	"apps/app/apis/lobby/api/internal/repository/model"
	"apps/app/apis/lobby/api/internal/svc"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"

	"go.uber.org/mock/gomock"
)

func setup(t *testing.T) (*Logic, *mocks.MockUserStore, *mocks.MockRechargeStore) {
	t.Helper()
	ctrl := gomock.NewController(t)
	users := mocks.NewMockUserStore(ctrl)
	store := mocks.NewMockRechargeStore(ctrl)
	l := New(svc.New(config.Config{RechargeTiers: []config.RechargeTier{{ID: "bonus", Amount: 10000, Bonus: 1000}, {ID: "fee", Amount: 10000, Fee: 200}}}, &repository.Repository{Users: users, Recharge: store}))
	return l, users, store
}

func request() *pb.RechargeRequest {
	uid := int64(7)
	sid := strings.Repeat("a", 52)
	return &pb.RechargeRequest{Uid: &uid, Sid: &sid, TierId: "bonus", RequestId: "request_1"}
}

func TestRechargeList(t *testing.T) {
	l, users, _ := setup(t)
	ctx := context.Background()
	if _, err := l.RechargeList(ctx, &pb.RechargeRequest{}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	users.EXPECT().Check(ctx, int64(7), gomock.Any(), gomock.Any()).Return(xerr.ErrSession)
	if _, err := l.RechargeList(ctx, request()); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	users.EXPECT().Check(ctx, int64(7), gomock.Any(), gomock.Any()).Return(nil)
	out, err := l.RechargeList(ctx, request())
	if err != nil || len(out.Items) != 2 || out.Items[0].CreditAmount != 11000 || out.Items[1].CreditAmount != 9800 {
		t.Fatal(out, err)
	}
}

func TestRechargeCreate(t *testing.T) {
	l, _, store := setup(t)
	ctx := context.Background()
	if _, err := l.RechargeCreate(ctx, &pb.RechargeRequest{}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	for _, id := range []string{"", " ", "abc\n", strings.Repeat("x", 129)} {
		r := request()
		r.RequestId = id
		if _, err := l.RechargeCreate(ctx, r); !errors.Is(err, xerr.ErrInvalid) {
			t.Fatal(id, err)
		}
	}
	r := request()
	r.TierId = ""
	if _, err := l.RechargeCreate(ctx, r); !errors.Is(err, xerr.ErrInvalid) {
		t.Fatal(err)
	}
	store.EXPECT().CreateRecharge(ctx, int64(7), gomock.Any(), "request_1", "bonus", gomock.Any(), gomock.Any()).Return(&model.LobbyRechargeOrder{OrderID: "order_1", Amount: 10000, Bonus: 1000, CreditAmount: 11000, Coins: 11000, Status: "success"}, nil)
	out, err := l.RechargeCreate(ctx, request())
	if err != nil || out.Status != "success" || out.OrderId != "order_1" {
		t.Fatal(out, err)
	}
	r = request()
	r.TierId = "removed"
	// Missing config still reaches idempotent lookup: a previously settled order may exist.
	store.EXPECT().CreateRecharge(ctx, int64(7), gomock.Any(), "request_1", "removed", nil, gomock.Any()).Return(nil, xerr.ErrRechargeTier)
	if _, err = l.RechargeCreate(ctx, r); !errors.Is(err, xerr.ErrRechargeTier) {
		t.Fatal(err)
	}
}

func TestOrderInfo(t *testing.T) {
	l, _, store := setup(t)
	ctx := context.Background()
	if _, err := l.RechargeOrderInfo(ctx, &pb.RechargeRequest{}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	r := request()
	if _, err := l.RechargeOrderInfo(ctx, r); !errors.Is(err, xerr.ErrInvalid) {
		t.Fatal(err)
	}
	r.OrderId = "order"
	store.EXPECT().ReadRechargeOrder(ctx, int64(7), gomock.Any(), "order", gomock.Any()).Return(nil, xerr.ErrOrderNotFound)
	if _, err := l.RechargeOrderInfo(ctx, r); !errors.Is(err, xerr.ErrOrderNotFound) {
		t.Fatal(err)
	}
	now := time.Now()
	store.EXPECT().ReadRechargeOrder(ctx, int64(7), gomock.Any(), "order", gomock.Any()).Return(&model.LobbyRechargeOrder{OrderID: "order", Status: "success", SettledAt: &now}, nil)
	out, err := l.RechargeOrderInfo(ctx, r)
	if err != nil || out.SettledAt == "" {
		t.Fatal(out, err)
	}
}

func TestOrderList(t *testing.T) {
	l, _, store := setup(t)
	ctx := context.Background()
	if _, err := l.RechargeOrderList(ctx, &pb.RechargeRequest{}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	for _, modify := range []func(*pb.RechargeRequest){
		func(r *pb.RechargeRequest) { r.Status = "bad" }, func(r *pb.RechargeRequest) { r.Limit = -1 }, func(r *pb.RechargeRequest) { r.Limit = 101 },
		func(r *pb.RechargeRequest) { r.Cursor = "!" }, func(r *pb.RechargeRequest) { r.Cursor = strings.Repeat("a", 513) },
		func(r *pb.RechargeRequest) { r.Cursor = base64.RawURLEncoding.EncodeToString([]byte("{}")) },
	} {
		r := request()
		modify(r)
		if _, err := l.RechargeOrderList(ctx, r); !errors.Is(err, xerr.ErrInvalid) {
			t.Fatal(err)
		}
	}
	store.EXPECT().ReadRechargeOrders(ctx, int64(7), gomock.Any(), model.OrderQuery{Limit: 20}, gomock.Any()).Return(nil, xerr.ErrSession)
	if _, err := l.RechargeOrderList(ctx, request()); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	r := request()
	r.Limit = 1
	r.Status = "success"
	store.EXPECT().ReadRechargeOrders(ctx, int64(7), gomock.Any(), model.OrderQuery{Limit: 1, Status: "success"}, gomock.Any()).Return([]*model.LobbyRechargeOrder{{OrderID: "b", CreatedAt: now}, {OrderID: "a", CreatedAt: now}}, nil)
	out, err := l.RechargeOrderList(ctx, r)
	if err != nil || len(out.Items) != 1 || out.NextCursor == "" {
		t.Fatal(out, err)
	}
	r.Cursor = out.NextCursor
	store.EXPECT().ReadRechargeOrders(ctx, int64(7), gomock.Any(), model.OrderQuery{Limit: 1, Status: "success", BeforeTime: now, BeforeID: "b"}, gomock.Any()).Return([]*model.LobbyRechargeOrder{{OrderID: "a", CreatedAt: now}}, nil)
	out, err = l.RechargeOrderList(ctx, r)
	if err != nil || len(out.Items) != 1 || out.NextCursor != "" {
		t.Fatal(out, err)
	}
	data, _ := json.Marshal(orderCursor{Time: now, ID: "b"})
	if r.Cursor != base64.RawURLEncoding.EncodeToString(data) {
		t.Fatal("cursor mismatch")
	}
}
