package userservice

import (
	"context"
	"errors"
	"testing"

	"apps/app/apis/lobby/api/internal/config"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"

	"go.uber.org/mock/gomock"
)

func TestWithdrawalAuthTiersAndTestGate(t *testing.T) {
	s, m := setup(t)
	ctx := context.Background()
	r := request()
	s.WithdrawalTiers = []config.RechargeTier{{ID: "50", Amount: 5000, Fee: 150}, {ID: "200", Amount: 20000, Bonus: 200}}
	if _, e := s.WithdrawalList(ctx, &pb.UserRequest{}); !errors.Is(e, xerr.ErrSession) {
		t.Fatal(e)
	}
	m.EXPECT().Check(ctx, r.GetUid(), Hash(r.GetSid()), gomock.Any()).Return(nil).AnyTimes()
	v, e := s.WithdrawalList(ctx, r)
	if e != nil || v.TestMode || len(v.Items) != 2 || v.Items[0].PayoutAmount != 4850 || v.Items[1].PayoutAmount != 20000 {
		t.Fatal(v, e)
	}
	if _, e = s.WithdrawalReview(ctx, &pb.WithdrawalRequest{}); !errors.Is(e, xerr.ErrWithdrawalTestDisabled) {
		t.Fatal(e)
	}
	s.WithdrawalTestMode = true
	if _, e = s.WithdrawalReview(ctx, &pb.WithdrawalRequest{Decision: "invalid"}); !errors.Is(e, xerr.ErrInvalid) {
		t.Fatal(e)
	}
	if _, e = s.WithdrawalReview(ctx, &pb.WithdrawalRequest{Decision: "approve"}); !errors.Is(e, xerr.ErrSession) {
		t.Fatal(e)
	}
	if _, e = s.WithdrawalCreate(ctx, &pb.WithdrawalRequest{Uid: r.Uid, Sid: r.Sid, RequestId: "short"}); !errors.Is(e, xerr.ErrInvalid) {
		t.Fatal(e)
	}
	for _, v := range []*pb.WithdrawalRequest{{Kind: "bad"}, {From: "bad"}, {From: "2026-01-01T00:00:00Z", To: "2026-02-01T00:00:00Z", Cursor: "!"}, {From: "2026-01-01T00:00:00Z", To: "2028-01-01T00:00:00Z"}} {
		v.Uid = r.Uid
		v.Sid = r.Sid
		if _, e = s.CashOrders(ctx, v); !errors.Is(e, xerr.ErrInvalid) {
			t.Fatal(v, e)
		}
	}
}

func TestTurnoverRequiresSession(t *testing.T) {
	s, m := setup(t)
	ctx := context.Background()
	if _, e := s.WithdrawalTurnover(ctx, &pb.UserRequest{}); !errors.Is(e, xerr.ErrSession) {
		t.Fatal(e)
	}
	r := request()
	m.EXPECT().Check(ctx, r.GetUid(), Hash(r.GetSid()), gomock.Any()).Return(xerr.ErrSession)
	if _, e := s.WithdrawalTurnover(ctx, r); !errors.Is(e, xerr.ErrSession) {
		t.Fatal(e)
	}
	m.EXPECT().Check(ctx, r.GetUid(), Hash(r.GetSid()), gomock.Any()).Return(nil)
	if _, e := s.WithdrawalTurnover(ctx, r); e == nil {
		t.Fatal("missing withdrawal store accepted")
	}
}
