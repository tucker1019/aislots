package returnservice

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

func TestReturnLogic(t *testing.T) {
	ctx := context.Background()
	store := mocks.NewMockReturnStore(gomock.NewController(t))
	cfg := config.ReturnConfig{DailyRateBps: 80, WeeklyRateBps: 10, MonthlyRateBps: 10, LoserReturnRateBps: 1000}
	l := New(svc.New(config.Config{Returns: cfg, Checkin: config.CheckinConfig{Timezone: "Asia/Jakarta"}}, &repository.Repository{Returns: store}))
	uid := int64(7)
	sid := strings.Repeat("a", 52)
	request := func() *pb.ReturnRequest { return &pb.ReturnRequest{Uid: &uid, Sid: &sid, ActivityDate: "2026-06-01"} }
	if _, err := l.RebateInfo(ctx, &pb.ReturnRequest{}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	if _, err := l.LoserReturnInfo(ctx, &pb.ReturnRequest{}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	for _, group := range []string{model.GroupRebate, model.GroupLoser} {
		store.EXPECT().ReadReturns(ctx, uid, gomock.Any(), group, cfg, l.location, gomock.Any()).Return(nil, xerr.ErrSession)
		if group == model.GroupRebate {
			if _, err := l.RebateInfo(ctx, request()); !errors.Is(err, xerr.ErrSession) {
				t.Fatal(err)
			}
		} else {
			if _, err := l.LoserReturnInfo(ctx, request()); !errors.Is(err, xerr.ErrSession) {
				t.Fatal(err)
			}
		}
	}
	now := time.Date(2026, 6, 1, 0, 0, 0, 0, l.location)
	section := func(kind string) *model.ReturnSection {
		return &model.ReturnSection{Claim: &model.ReturnPeriod{LobbyReturnClaim: model.LobbyReturnClaim{Kind: kind, Reward: 100, BetAmount: 10000, WinAmount: 8000}, Status: "claimable", AvailableAt: now, ExpiresAt: now.AddDate(0, 0, 1)}, Preview: &model.ReturnPeriod{Status: "preview", AvailableAt: now.AddDate(0, 0, 1), ExpiresAt: now.AddDate(0, 0, 2)}}
	}
	store.EXPECT().ReadReturns(ctx, uid, gomock.Any(), model.GroupRebate, cfg, l.location, gomock.Any()).Return(&model.ReturnView{Date: "2026-06-01", Total: 300, Sections: []*model.ReturnSection{section(model.ReturnDaily), section(model.ReturnWeekly), section(model.ReturnMonthly)}}, nil)
	out, err := l.RebateInfo(ctx, request())
	if err != nil || out.ClaimableTotal != 300 || out.Daily.Claim.Type != "daily" || out.Weekly.Claim.Type != "weekly" || out.Monthly.Claim.Type != "monthly" || out.Daily.Claim.LossAmount != 2000 {
		t.Fatal(out, err)
	}
	store.EXPECT().ReadReturns(ctx, uid, gomock.Any(), model.GroupLoser, cfg, l.location, gomock.Any()).Return(&model.ReturnView{Date: "2026-06-01", Total: 100, Sections: []*model.ReturnSection{section(model.ReturnLoser)}}, nil)
	loser, err := l.LoserReturnInfo(ctx, request())
	if err != nil || loser.ClaimableTotal != 100 || loser.Daily.Claim.Type != "loser_return" {
		t.Fatal(loser, err)
	}
	for _, action := range []struct {
		group string
		call  func(context.Context, *pb.ReturnRequest) (*pb.ReturnClaimReply, error)
	}{{model.GroupRebate, l.RebateClaim}, {model.GroupLoser, l.LoserReturnClaim}} {
		if _, err := action.call(ctx, &pb.ReturnRequest{}); !errors.Is(err, xerr.ErrSession) {
			t.Fatal(err)
		}
		bad := request()
		bad.ActivityDate = "bad"
		if _, err := action.call(ctx, bad); !errors.Is(err, xerr.ErrInvalid) {
			t.Fatal(err)
		}
		store.EXPECT().ClaimReturns(ctx, uid, gomock.Any(), action.group, "2026-06-01", cfg, l.location, gomock.Any()).Return(nil, xerr.ErrReturnEmpty)
		if _, err := action.call(ctx, request()); !errors.Is(err, xerr.ErrReturnEmpty) {
			t.Fatal(err)
		}
		store.EXPECT().ClaimReturns(ctx, uid, gomock.Any(), action.group, "2026-06-01", cfg, l.location, gomock.Any()).Return(&model.ReturnReceipt{Batch: model.LobbyReturnBatch{ClaimID: "ret_1", ClaimDate: "2026-06-01", TotalReward: 10, Coins: 110}, Items: []*model.LobbyReturnClaim{{Kind: "daily", PeriodStart: "2026-05-31", PeriodEnd: "2026-06-01", Reward: 10, BetAmount: 10, WinAmount: 20}}}, nil)
		receipt, err := action.call(ctx, request())
		if err != nil || receipt.TotalReward != 10 || receipt.Coins != 110 || len(receipt.Items) != 1 || receipt.Items[0].LossAmount != 0 || receipt.Items[0].ExpiresAt != "2026-06-02T00:00:00+07:00" {
			t.Fatal(receipt, err)
		}
	}
}
