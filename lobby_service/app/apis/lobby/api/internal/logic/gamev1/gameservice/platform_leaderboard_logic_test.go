package gameservice

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/mocks"
	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"

	"go.uber.org/mock/gomock"
)

type leaderboardFake struct {
	fake
	rows      []model.PlatformLeaderboardView
	statuses  map[int]string
	ensureErr error
	statusErr error
	claimErr  error
	claim     *model.PlatformRewardReceipt
	statusNow time.Time
}

func (f *leaderboardFake) ReadPlatformLeaderboard(context.Context, string, string, time.Time) ([]model.PlatformLeaderboardView, error) {
	return f.rows, nil
}
func (f *leaderboardFake) EnsurePlatformLeaderboardRewards(context.Context, time.Time, string, []int64) error {
	return f.ensureErr
}
func (f *leaderboardFake) ReadPlatformRewardStatuses(_ context.Context, _ time.Time, _ string, now time.Time) (map[int]string, error) {
	f.statusNow = now
	return f.statuses, f.statusErr
}
func (f *leaderboardFake) ClaimPlatformLeaderboardReward(context.Context, int64, time.Time, string, int, bool, time.Time) (*model.PlatformRewardReceipt, error) {
	return f.claim, f.claimErr
}

func TestPlatformLeaderboardShowsClaimStatusAndValidatesRequests(t *testing.T) {
	ctx := context.Background()
	user := int64(7)
	sid := strings.Repeat("s", 52)
	controller := gomock.NewController(t)
	users := mocks.NewMockUserStore(controller)
	users.EXPECT().Check(ctx, user, gomock.Any(), gomock.Any()).Return(nil)
	store := &leaderboardFake{rows: []model.PlatformLeaderboardView{{UID: user, GameID: "AG1", BetID: "bet", BetAmount: "100", WinAmount: "200"}}, statuses: map[int]string{1: "expired"}}
	logic := &Logic{users: users, store: store, leaderboardConfig: config.LeaderboardConfig{Rewards: []int64{100}}, location: time.UTC, config: config.GameConfig{Games: map[string]config.GameEntry{"AG1": {Name: "Game", Cover: "/game.png"}}}}
	out, err := logic.PlatformLeaderboard(ctx, &pb.PlatformLeaderboardRequest{Uid: &user, Sid: &sid, Board: "wins", Period: "yesterday"})
	if err != nil || len(out.Items) != 1 || out.Items[0].RewardStatus != "expired" || out.Items[0].Claimable || out.Items[0].RewardAmount != "100" || store.statusNow.IsZero() {
		t.Fatal(out, err, store.statusNow)
	}
	for _, request := range []*pb.PlatformLeaderboardRequest{{Board: "bad", Period: "today"}, {Board: "wins", Period: "bad"}} {
		if _, err = logic.PlatformLeaderboard(ctx, request); !errors.Is(err, xerr.ErrInvalid) {
			t.Fatal(err)
		}
	}
	users.EXPECT().Check(ctx, user, gomock.Any(), gomock.Any()).Return(xerr.ErrSession)
	if _, err = logic.PlatformLeaderboard(ctx, &pb.PlatformLeaderboardRequest{Uid: &user, Sid: &sid, Board: "wins", Period: "today"}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
}

func TestPlatformLeaderboardClaimWindowAndErrors(t *testing.T) {
	ctx := context.Background()
	user := int64(9)
	sid := strings.Repeat("a", 52)
	location := time.UTC
	users := mocks.NewMockUserStore(gomock.NewController(t))
	store := &leaderboardFake{claim: &model.PlatformRewardReceipt{ClaimID: "claim", Amount: 12, Coins: 50, Status: "claimed"}}
	logic := &Logic{users: users, store: store, leaderboardConfig: config.LeaderboardConfig{Rewards: make([]int64, 10)}, location: location}
	date := time.Now().UTC().AddDate(0, 0, -2).Format(time.DateOnly)
	users.EXPECT().Check(ctx, user, gomock.Any(), gomock.Any()).Return(nil)
	out, err := logic.PlatformLeaderboardClaim(ctx, &pb.PlatformLeaderboardClaimRequest{Uid: user, Sid: sid, Date: date, Board: "wins", Rank: 1})
	if err != nil || out.ClaimId != "claim" || out.Amount != 12 || out.Coins != 50 {
		t.Fatal(out, err)
	}
	users.EXPECT().Check(ctx, user, gomock.Any(), gomock.Any()).Return(nil)
	if _, err = logic.PlatformLeaderboardClaim(ctx, &pb.PlatformLeaderboardClaimRequest{Uid: user, Sid: sid, Date: "bad", Board: "wins", Rank: 1}); !errors.Is(err, xerr.ErrInvalid) {
		t.Fatal(err)
	}
	today := time.Now().UTC().Format(time.DateOnly)
	users.EXPECT().Check(ctx, user, gomock.Any(), gomock.Any()).Return(nil)
	if _, err = logic.PlatformLeaderboardClaim(ctx, &pb.PlatformLeaderboardClaimRequest{Uid: user, Sid: sid, Date: today, Board: "wins", Rank: 1}); !errors.Is(err, xerr.ErrInvalid) {
		t.Fatal(err)
	}
	users.EXPECT().Check(ctx, user, gomock.Any(), gomock.Any()).Return(nil)
	store.claimErr = errors.New("database")
	if _, err = logic.PlatformLeaderboardClaim(ctx, &pb.PlatformLeaderboardClaimRequest{Uid: user, Sid: sid, Date: date, Board: "wins", Rank: 1}); err == nil {
		t.Fatal("claim error swallowed")
	}
}
