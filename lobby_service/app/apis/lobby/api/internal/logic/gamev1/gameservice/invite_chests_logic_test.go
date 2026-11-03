package gameservice

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
)

type detailInviteFake struct {
	inviteFake
	detailErr error
}

func (f detailInviteFake) Chests(context.Context, int64, int) ([]model.LobbyInviteReward, error) {
	batch := "batch"
	return []model.LobbyInviteReward{{Slot: 1, InviteeUID: 11, Amount: 20000, BatchID: &batch}, {Slot: 2, InviteeUID: 12, Amount: 20000}}, f.detailErr
}

func (f detailInviteFake) Friends(context.Context, int64, int, time.Time) ([]model.InviteFriendRow, error) {
	rows := []model.InviteFriendRow{{InviteeUID: 11, Account: "friend", RegisteredAt: time.Now(), DurationDays: 30, RequiredDepositCount: 5, RequiredDepositAmount: 50000, RequiredBetAmount: 500000}, {InviteeUID: 12, Qualified: true}}
	for len(rows) < 21 {
		rows = append(rows, model.InviteFriendRow{InviteeUID: int64(len(rows) + 20), Qualified: true})
	}
	return rows, f.detailErr
}

func (f detailInviteFake) ClaimOne(context.Context, int64, string, time.Time, int64) (*model.LobbyInviteBatch, error) {
	return &model.LobbyInviteBatch{ClaimID: "one", TotalReward: 20000, Coins: 30000}, f.detailErr
}

func TestInviteChestAndFriendEndpoints(t *testing.T) {
	ctx := context.Background()
	uid := int64(7)
	sid := strings.Repeat("s", 52)
	r := &pb.InviteRequest{Uid: &uid, Sid: &sid, Page: 1, RewardId: "12", RequestId: "one"}
	l := &Logic{users: recordUsers{}, invite: detailInviteFake{}, inviteConfig: config.InviteConfig{BaseURL: "https://example.com/", RewardAmount: 20000}}
	chests, e := l.InviteChests(ctx, r)
	if e != nil || len(chests.Items) != 100 || chests.Items[0].Status != "claimed" || chests.Items[1].RewardId != "12" || chests.Items[1].Status != "claimable" || chests.Items[2].Status != "locked" {
		t.Fatal(chests, e)
	}
	friends, e := l.InviteFriends(ctx, r)
	if e != nil || len(friends.Items) != 20 || !friends.HasMore || len(friends.Items[0].Reasons) != 4 || friends.Items[0].DurationDays != 30 || len(friends.Items[1].Reasons) != 0 {
		t.Fatal(friends, e)
	}
	if b, err := l.InviteChestClaim(ctx, r); err != nil || b.TotalReward != 20000 {
		t.Fatal(b, err)
	}
	for _, bad := range []string{"", "0", "-1", "+12", "oops"} {
		r.RewardId = bad
		if _, e = l.InviteChestClaim(ctx, r); e == nil {
			t.Fatal("invalid target accepted", bad)
		}
	}
	r.RewardId = "12"
	r.RequestId = ""
	if _, e = l.InviteChestClaim(ctx, r); e == nil {
		t.Fatal("missing nonce")
	}
	r.RequestId = "one"
	for _, page := range []int32{0, -1, 10001} {
		r.Page = page
		if _, e = l.InviteChests(ctx, r); e == nil {
			t.Fatal("invalid page")
		}
		if _, e = l.InviteFriends(ctx, r); e == nil {
			t.Fatal("invalid friend page")
		}
	}
	r.Page = 1
	l.invite = detailInviteFake{detailErr: errors.New("db")}
	if _, e = l.InviteChests(ctx, r); e == nil {
		t.Fatal("chest db error")
	}
	if _, e = l.InviteFriends(ctx, r); e == nil {
		t.Fatal("friend db error")
	}
	if _, e = l.InviteChestClaim(ctx, r); e == nil {
		t.Fatal("claim db error")
	}
	l.invite = inviteFake{}
	if _, e = l.InviteChests(ctx, r); e == nil {
		t.Fatal("missing detail store")
	}
	if _, e = l.InviteFriends(ctx, r); e == nil {
		t.Fatal("missing detail store")
	}
	if _, e = l.InviteChestClaim(ctx, r); e == nil {
		t.Fatal("missing detail store")
	}
	l.users = recordUsers{err: xerr.ErrSession}
	if _, e = l.InviteChests(ctx, r); e == nil {
		t.Fatal("missing auth")
	}
	if _, e = l.InviteFriends(ctx, r); e == nil {
		t.Fatal("missing auth")
	}
	if _, e = l.InviteChestClaim(ctx, r); e == nil {
		t.Fatal("missing auth")
	}
}
