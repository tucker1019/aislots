package vipservice

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

func TestVIPLogic(t *testing.T) {
	ctx := context.Background()
	store := mocks.NewMockVIPStore(gomock.NewController(t))
	c := config.VIPConfig{Version: "v1", IdleDays: 30, ProtectionDays: 15, Levels: []config.VIPLevel{{}, {Level: 1, UpgradeBet: 100, UpgradeReward: 200}}}
	l := New(svc.New(config.Config{VIP: c, Checkin: config.CheckinConfig{Timezone: "Asia/Jakarta"}}, &repository.Repository{VIP: store}))
	uid := int64(7)
	sid := strings.Repeat("a", 52)
	request := func() *pb.VipRequest {
		return &pb.VipRequest{Uid: &uid, Sid: &sid, RequestId: "req", ActivityDate: "2026-06-01", RewardId: "reward-1"}
	}
	if _, err := l.VipInfo(ctx, &pb.VipRequest{}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	store.EXPECT().ReadVIP(ctx, uid, gomock.Any(), gomock.Any()).Return(nil, xerr.ErrSession)
	if _, err := l.VipInfo(ctx, request()); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	deadline := now.Add(time.Hour)
	for _, protecting := range []bool{false, true} {
		s := &model.LobbyVipState{Level: 1, HighestLevel: 1, UpgradeBet: 5, IdleSince: now}
		if protecting {
			s.ProtectionStart = &now
			s.ProtectionEnd = &deadline
		}
		store.EXPECT().ReadVIP(ctx, uid, gomock.Any(), gomock.Any()).Return(&model.VIPView{State: s, UpgradeTotal: 200, Upgrades: []*model.LobbyVipReward{{Kind: "upgrade", Amount: 200, Status: "pending"}}, Weekly: &model.LobbyVipReward{Kind: "weekly", Status: "pending", ExpiresAt: &deadline}, Monthly: &model.LobbyVipReward{Kind: "monthly", Status: "no_reward"}, WeeklyPreview: &model.LobbyVipReward{Status: "preview"}}, nil)
		out, err := l.VipInfo(ctx, request())
		if err != nil || out.UpgradeClaimableTotal != 200 || len(out.Levels) != 2 || out.Levels[1].UpgradeBet != 100 || out.Weekly.Status != "claimable" {
			t.Fatal(out, err)
		}
		if protecting && out.State.Status != "protecting" {
			t.Fatal(out.State)
		}
		if !protecting && out.State.Status != "normal" {
			t.Fatal(out.State)
		}
	}
	for _, test := range []struct {
		kind string
		call func(context.Context, *pb.VipRequest) (*pb.VipClaimReply, error)
	}{{"upgrade", l.VipUpgradeClaim}, {"weekly", l.VipWeeklyClaim}, {"monthly", l.VipMonthlyClaim}} {
		if _, err := test.call(ctx, &pb.VipRequest{}); !errors.Is(err, xerr.ErrSession) {
			t.Fatal(err)
		}
		for _, id := range []string{"", " ", "a\n", strings.Repeat("x", 129)} {
			r := request()
			r.RequestId = id
			if _, err := test.call(ctx, r); !errors.Is(err, xerr.ErrInvalid) {
				t.Fatal(err)
			}
		}
		r := request()
		r.ActivityDate = "bad"
		if _, err := test.call(ctx, r); !errors.Is(err, xerr.ErrInvalid) {
			t.Fatal(err)
		}
		store.EXPECT().ClaimVIP(ctx, uid, gomock.Any(), test.kind, "req", "2026-06-01", "reward-1", gomock.Any()).Return(nil, xerr.ErrVIPEmpty)
		if _, err := test.call(ctx, request()); !errors.Is(err, xerr.ErrVIPEmpty) {
			t.Fatal(err)
		}
		store.EXPECT().ClaimVIP(ctx, uid, gomock.Any(), test.kind, "req", "2026-06-01", "reward-1", gomock.Any()).Return(&model.VIPReceipt{Batch: model.LobbyVipClaimBatch{ClaimID: "vpc_1", TotalReward: 200, Coins: 1200}, Items: []*model.LobbyVipReward{{Kind: test.kind, Level: 1, Amount: 200, Status: "claimed"}}}, nil)
		out, err := test.call(ctx, request())
		if err != nil || out.Coins != 1200 || out.Items[0].Kind != test.kind {
			t.Fatal(out, err)
		}
	}
	past := now.Add(-time.Hour)
	if out := rewardReply(&model.LobbyVipReward{Status: "pending", ExpiresAt: &past}, now); out.Status != "expired" {
		t.Fatal(out)
	}
	if out := rewardReply(nil, now); out.Status != "" {
		t.Fatal(out)
	}
}
