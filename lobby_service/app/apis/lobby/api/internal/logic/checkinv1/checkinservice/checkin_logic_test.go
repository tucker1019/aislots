package checkinservice

import (
	"context"
	"errors"
	"strings"
	"testing"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository"
	"apps/app/apis/lobby/api/internal/repository/mocks"
	"apps/app/apis/lobby/api/internal/repository/model"
	"apps/app/apis/lobby/api/internal/svc"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"

	"go.uber.org/mock/gomock"
)

func TestCheckinLogic(t *testing.T) {
	ctx := context.Background()
	store := mocks.NewMockCheckinStore(gomock.NewController(t))
	c := config.CheckinConfig{Version: "v1", Timezone: "Asia/Jakarta", Days: []config.CheckinDay{{RequiredBet: 100, RequiredRecharge: 200, Reward: 10}}}
	l := New(svc.New(config.Config{Checkin: c}, &repository.Repository{Checkin: store}))
	uid := int64(1)
	sid := strings.Repeat("a", 52)
	r := &pb.CheckinRequest{Uid: &uid, Sid: &sid, ActivityDate: "2026-11-03"}
	if _, err := l.CheckinInfo(ctx, &pb.CheckinRequest{}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	if _, err := l.CheckinClaim(ctx, &pb.CheckinRequest{}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	bad := &pb.CheckinRequest{Uid: &uid, Sid: &sid}
	if _, err := l.CheckinClaim(ctx, bad); !errors.Is(err, xerr.ErrInvalid) {
		t.Fatal(err)
	}
	store.EXPECT().ReadCheckin(ctx, uid, gomock.Any(), c, gomock.Any()).Return(nil, xerr.ErrSession)
	if _, err := l.CheckinInfo(ctx, r); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	for _, claimed := range []bool{false, true} {
		store.EXPECT().ReadCheckin(ctx, uid, gomock.Any(), c, gomock.Any()).Return(&model.CheckinState{Date: r.ActivityDate, Day: 1, Claimed: claimed, Rule: c.Days[0], Daily: model.LobbyActivityDaily{ValidBet: 100, RechargeAmount: 200}}, nil)
		out, err := l.CheckinInfo(ctx, r)
		if err != nil || out.CanClaim == claimed || out.NextResetAt != "2026-11-04T00:00:00+07:00" || len(out.Days) != 1 || out.Current.Reward != 10 {
			t.Fatal(out, err)
		}
	}
	store.EXPECT().ClaimCheckin(ctx, uid, gomock.Any(), r.ActivityDate, c, gomock.Any()).Return(nil, xerr.ErrCheckinCondition)
	if _, err := l.CheckinClaim(ctx, r); !errors.Is(err, xerr.ErrCheckinCondition) {
		t.Fatal(err)
	}
	store.EXPECT().ClaimCheckin(ctx, uid, gomock.Any(), r.ActivityDate, c, gomock.Any()).Return(&model.LobbyCheckinClaim{ClaimID: "chk_1", BusinessDate: r.ActivityDate, Day: 1, Reward: 10, Coins: 100}, nil)
	out, err := l.CheckinClaim(ctx, r)
	if err != nil || out.Coins != 100 || out.Reward != 10 || out.ClaimId != "chk_1" {
		t.Fatal(out, err)
	}
}
