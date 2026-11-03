package gameservice

import (
	"context"
	"strconv"
	"time"

	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
)

type inviteDetailStore interface {
	Chests(context.Context, int64, int) ([]model.LobbyInviteReward, error)
	Friends(context.Context, int64, int, time.Time) ([]model.InviteFriendRow, error)
	ClaimOne(context.Context, int64, string, time.Time, int64) (*model.LobbyInviteBatch, error)
}

func (l *Logic) InviteChests(ctx context.Context, r *pb.InviteRequest) (*pb.InviteChestsReply, error) {
	if r.Page < 1 || r.Page > 10000 {
		return nil, xerr.ErrInvalid
	}
	info, e := l.InviteInfo(ctx, r)
	if e != nil {
		return nil, e
	}
	store, ok := l.invite.(inviteDetailStore)
	if !ok {
		return nil, xerr.ErrInvalid
	}
	rows, e := store.Chests(ctx, r.GetUid(), int(r.Page))
	if e != nil {
		return nil, xerr.Public(e)
	}
	out := &pb.InviteChestsReply{Info: info, Page: r.Page, HasMore: info.QualifiedCount > int64(r.Page)*100, Items: []*pb.InviteChest{}}
	bySlot := map[int64]model.LobbyInviteReward{}
	for _, row := range rows {
		bySlot[row.Slot] = row
	}
	for i := int64(r.Page-1)*100 + 1; i <= int64(r.Page)*100; i++ {
		item := &pb.InviteChest{Slot: i, Status: "locked", Amount: l.inviteConfig.RewardAmount}
		if row, exists := bySlot[i]; exists {
			item.Amount = row.Amount
			item.RewardId = strconv.FormatInt(row.InviteeUID, 10)
			item.Status = "claimable"
			if row.BatchID != nil {
				item.Status = "claimed"
			}
		}
		out.Items = append(out.Items, item)
	}
	return out, nil
}

func (l *Logic) InviteChestClaim(ctx context.Context, r *pb.InviteRequest) (*pb.InviteClaimReply, error) {
	if e := l.inviteAuth(ctx, r); e != nil {
		return nil, e
	}
	target, e := strconv.ParseInt(r.RewardId, 10, 64)
	if e != nil || target <= 0 || strconv.FormatInt(target, 10) != r.RewardId || !validInviteRequestID(r.RequestId) {
		return nil, xerr.ErrInvalid
	}
	store, ok := l.invite.(inviteDetailStore)
	if !ok {
		return nil, xerr.ErrInvalid
	}
	b, e := store.ClaimOne(ctx, r.GetUid(), r.RequestId, time.Now().UTC(), target)
	if e != nil {
		return nil, xerr.Public(e)
	}
	return &pb.InviteClaimReply{ClaimId: b.ClaimID, TotalReward: b.TotalReward, Coins: b.Coins}, nil
}

func (l *Logic) InviteFriends(ctx context.Context, r *pb.InviteRequest) (*pb.InviteFriendsReply, error) {
	if e := l.inviteAuth(ctx, r); e != nil {
		return nil, e
	}
	if r.Page < 1 || r.Page > 10000 {
		return nil, xerr.ErrInvalid
	}
	store, ok := l.invite.(inviteDetailStore)
	if !ok {
		return nil, xerr.ErrInvalid
	}
	rows, e := store.Friends(ctx, r.GetUid(), int(r.Page), time.Now().UTC())
	if e != nil {
		return nil, xerr.Public(e)
	}
	out := &pb.InviteFriendsReply{Page: r.Page, HasMore: len(rows) > 20, Items: []*pb.InviteFriend{}}
	if len(rows) > 20 {
		rows = rows[:20]
	}
	for _, row := range rows {
		reasons := []string{}
		if !row.Qualified {
			if !row.PayoutBound {
				reasons = append(reasons, "payout_account")
			}
			if row.DepositCount < int64(row.RequiredDepositCount) {
				reasons = append(reasons, "deposit_count")
			}
			if row.DepositAmount < row.RequiredDepositAmount {
				reasons = append(reasons, "deposit_amount")
			}
			if row.BetAmount < row.RequiredBetAmount {
				reasons = append(reasons, "bet_amount")
			}
		}
		out.Items = append(out.Items, &pb.InviteFriend{Uid: strconv.FormatInt(row.InviteeUID, 10), Account: row.Account, RegisteredAt: row.RegisteredAt.UTC().Format(time.RFC3339Nano), DepositCount: row.DepositCount, DepositAmount: row.DepositAmount, BetAmount: row.BetAmount, Qualified: row.Qualified, Reasons: reasons, RequiredDepositCount: row.RequiredDepositCount, RequiredDepositAmount: row.RequiredDepositAmount, RequiredBetAmount: row.RequiredBetAmount, DurationDays: row.DurationDays})
	}
	return out, nil
}
