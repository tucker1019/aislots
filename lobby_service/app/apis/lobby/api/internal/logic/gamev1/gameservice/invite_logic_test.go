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

type inviteFake struct{ err error }

func (f inviteFake) Read(context.Context, int64, time.Time) (*model.InviteView, error) {
	return &model.InviteView{Code: "ABC", InvitedCount: 3, PendingAmount: 20000}, f.err
}

func (f inviteFake) Claim(context.Context, int64, string, time.Time) (*model.LobbyInviteBatch, error) {
	return &model.LobbyInviteBatch{ClaimID: "claim", TotalReward: 20000, Coins: 30000}, f.err
}

func TestInviteInfoAndClaimAuthentication(t *testing.T) {
	ctx := context.Background()
	id := int64(7)
	sid := strings.Repeat("s", 52)
	r := &pb.InviteRequest{Uid: &id, Sid: &sid, RequestId: "request"}
	l := &Logic{users: recordUsers{}, invite: inviteFake{}, inviteConfig: config.InviteConfig{BaseURL: "https://example.com/", SupportURL: "https://t.me/tucker881", DurationDays: 30}}
	v, e := l.InviteInfo(ctx, r)
	if e != nil || v.InviteUrl != "https://example.com/?inviteCode=ABC" || v.PendingAmount != 20000 || v.Rules.DurationDays != 30 {
		t.Fatal(v, e)
	}
	b, e := l.InviteClaim(ctx, r)
	if e != nil || b.TotalReward != 20000 {
		t.Fatal(b, e)
	}
	for _, bad := range []string{"", " space", strings.Repeat("x", 129), "bad\n"} {
		r.RequestId = bad
		if _, e = l.InviteClaim(ctx, r); e == nil {
			t.Fatal("bad request accepted")
		}
	}
	r.RequestId = "request"
	l.invite = inviteFake{err: errors.New("db")}
	if _, e = l.InviteInfo(ctx, r); e == nil {
		t.Fatal("read error")
	}
	if _, e = l.InviteClaim(ctx, r); e == nil {
		t.Fatal("claim error")
	}
	l.invite = nil
	if _, e = l.InviteInfo(ctx, r); e == nil {
		t.Fatal("missing store")
	}
	l.users = recordUsers{err: xerr.ErrSession}
	if _, e = l.InviteClaim(ctx, r); e == nil {
		t.Fatal("bad session")
	}
	r.Uid = nil
	if _, e = l.InviteInfo(ctx, r); e == nil {
		t.Fatal("missing uid")
	}
}
