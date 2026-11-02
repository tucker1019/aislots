package newbieservice

import (
	"context"
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

func TestNewbieLogic(t *testing.T) {
	ctx := context.Background()
	store := mocks.NewMockNewbieStore(gomock.NewController(t))
	l := New(svc.New(config.Config{}, &repository.Repository{Newbie: store}))
	uid := int64(7)
	sid := strings.Repeat("a", 52)
	r := &pb.NewbieRechargeRequest{Uid: &uid, Sid: &sid, RequestId: "req"}
	if _, err := l.NewbieRechargeInfo(ctx, &pb.NewbieRechargeRequest{}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	if _, err := l.NewbieRechargeClaim(ctx, &pb.NewbieRechargeRequest{}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	store.EXPECT().ReadNewbie(ctx, uid, gomock.Any(), gomock.Any()).Return(nil, xerr.ErrSession)
	if _, err := l.NewbieRechargeInfo(ctx, r); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	for _, ended := range []bool{false, true} {
		end := now.Add(time.Hour)
		if ended {
			end = now.Add(-time.Hour)
		}
		store.EXPECT().ReadNewbie(ctx, uid, gomock.Any(), gomock.Any()).Return(&model.NewbieView{Enrollment: &model.LobbyNewbieRecharge{StartsAt: now.Add(-72 * time.Hour), EndsAt: end, DurationDays: 3, ConfigVersion: "v1"}, Amount: 100, ClaimableTotal: 10, Items: []*model.NewbieItem{{Tier: model.LobbyNewbieRechargeTier{TierID: "a", RequiredRecharge: 100, Reward: 10}, Progress: 100, Status: "claimable"}}}, nil)
		out, err := l.NewbieRechargeInfo(ctx, r)
		if err != nil || out.RechargeAmount != 100 || out.Items[0].Reward != 10 || out.ClaimableTotal != 10 {
			t.Fatal(out, err)
		}
		if ended && (out.Status != "ended" || out.RemainingSeconds != 0) {
			t.Fatal(out)
		}
		if !ended && (out.Status != "active" || out.RemainingSeconds <= 0) {
			t.Fatal(out)
		}
	}

	store.EXPECT().ReadNewbie(ctx, uid, gomock.Any(), gomock.Any()).Return(&model.NewbieView{Enrollment: &model.LobbyNewbieRecharge{EndsAt: now, EnrolledAt: now.Add(time.Hour)}}, nil)
	old, err := l.NewbieRechargeInfo(ctx, r)
	if err != nil || old.Status != "ineligible" {
		t.Fatal(old, err)
	}
	for _, id := range []string{"", " ", "abc\n", strings.Repeat("x", 129)} {
		bad := &pb.NewbieRechargeRequest{Uid: &uid, Sid: &sid, RequestId: id}
		if _, err := l.NewbieRechargeClaim(ctx, bad); !errors.Is(err, xerr.ErrInvalid) {
			t.Fatal(err)
		}
	}
	store.EXPECT().ClaimNewbie(ctx, uid, gomock.Any(), "req", gomock.Any()).Return(nil, xerr.ErrNewbieEmpty)
	if _, err := l.NewbieRechargeClaim(ctx, r); !errors.Is(err, xerr.ErrNewbieEmpty) {
		t.Fatal(err)
	}
	store.EXPECT().ClaimNewbie(ctx, uid, gomock.Any(), "req", gomock.Any()).Return(&model.NewbieReceipt{Batch: model.LobbyNewbieClaimBatch{ClaimID: "nrc_1", TotalReward: 10, Coins: 110}, Items: []*model.LobbyNewbieRechargeTier{{TierID: "a", RequiredRecharge: 100, Reward: 10}}}, nil)
	out, err := l.NewbieRechargeClaim(ctx, r)
	if err != nil || out.Coins != 110 || out.Items[0].Progress != 100 || out.Items[0].Status != "claimed" || out.Items[0].Remaining != 0 {
		t.Fatal(out, err)
	}
}
