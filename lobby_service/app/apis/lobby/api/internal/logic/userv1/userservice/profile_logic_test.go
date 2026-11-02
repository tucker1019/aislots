package userservice

import (
	"context"
	"errors"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"

	"go.uber.org/mock/gomock"
)

func TestProfileInfo(t *testing.T) {
	l, m := setup(t)
	ctx := context.Background()
	r := request()
	if _, err := l.ProfileInfo(ctx, &pb.UserRequest{}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	m.EXPECT().Profile(ctx, r.GetUid(), Hash(r.GetSid()), gomock.Any()).Return(&model.Profile{UID: 7, Nickname: "player_7", AvatarID: 15, Coins: 12345}, nil)
	out, err := l.ProfileInfo(ctx, r)
	if err != nil || out.Coins != 12345 || out.AvatarId != 15 || out.Nickname != "player_7" {
		t.Fatal(out, err)
	}
	m.EXPECT().Profile(ctx, r.GetUid(), gomock.Any(), gomock.Any()).Return(nil, xerr.ErrSession)
	if _, err = l.ProfileInfo(ctx, r); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
}

func TestProfileUpdateValidation(t *testing.T) {
	l, _ := setup(t)
	ctx := context.Background()
	if _, err := l.ProfileUpdate(ctx, &pb.UserRequest{}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	for _, name := range []string{"", "   ", "abc\n123", "1234567890123456789012345"} {
		r := request()
		r.Nickname = &name
		if _, err := l.ProfileUpdate(ctx, r); !errors.Is(err, xerr.ErrInvalid) {
			t.Fatal(name, err)
		}
	}
	for _, avatar := range []int32{0, 16, -1} {
		r := request()
		r.AvatarId = &avatar
		if _, err := l.ProfileUpdate(ctx, r); !errors.Is(err, xerr.ErrInvalid) {
			t.Fatal(avatar, err)
		}
	}
	if _, err := l.ProfileUpdate(ctx, request()); !errors.Is(err, xerr.ErrInvalid) {
		t.Fatal(err)
	}
}

func TestProfileUpdatePartial(t *testing.T) {
	l, m := setup(t)
	ctx := context.Background()
	r := request()
	name := "  玩家七  "
	r.Nickname = &name
	m.EXPECT().UpdateProfile(ctx, int64(7), Hash(r.GetSid()), gomock.Any(), gomock.Any(), nil).DoAndReturn(func(_ context.Context, _ int64, _ string, _ time.Time, name *string, _ *int32) (*model.Profile, error) {
		if *name != "玩家七" {
			t.Fatal(*name)
		}
		return &model.Profile{UID: 7, Nickname: *name, AvatarID: 3}, nil
	})
	if _, err := l.ProfileUpdate(ctx, r); err != nil {
		t.Fatal(err)
	}
	r = request()
	avatar := int32(15)
	r.AvatarId = &avatar
	m.EXPECT().UpdateProfile(ctx, int64(7), gomock.Any(), gomock.Any(), nil, &avatar).Return(&model.Profile{UID: 7, Nickname: "unchanged", AvatarID: 15}, nil)
	if out, err := l.ProfileUpdate(ctx, r); err != nil || out.Nickname != "unchanged" {
		t.Fatal(out, err)
	}
	r.Nickname = &name
	m.EXPECT().UpdateProfile(ctx, int64(7), gomock.Any(), gomock.Any(), gomock.Any(), &avatar).Return(nil, xerr.ErrSession)
	if _, err := l.ProfileUpdate(ctx, r); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
}
