package gameservice

import (
	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/mocks"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
	"context"
	"errors"
	"go.uber.org/mock/gomock"
	"google.golang.org/protobuf/proto"
	"strings"
	"testing"
)

type favoriteFake struct {
	ids             []string
	listErr, setErr error
	uid             int64
	selected        bool
}

func (f *favoriteFake) List(context.Context, int64) ([]string, error) { return f.ids, f.listErr }
func (f *favoriteFake) Set(_ context.Context, uid int64, _ string, value bool) error {
	f.uid = uid
	f.selected = value
	return f.setErr
}
func TestFavoritesAuthAndDesiredState(t *testing.T) {
	ctx := context.Background()
	users := mocks.NewMockUserStore(gomock.NewController(t))
	store := &favoriteFake{ids: []string{"AG2"}}
	l := &Logic{users: users, favorites: store, config: config.GameConfig{Games: map[string]config.GameEntry{"AG2": {Enabled: true}}}}
	uid := int64(7)
	sid := strings.Repeat("s", 52)
	if _, err := l.GameFavorites(ctx, &pb.GameFavoritesRequest{}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	users.EXPECT().Check(gomock.Any(), uid, gomock.Any(), gomock.Any()).Return(xerr.ErrSession)
	if _, err := l.GameFavorites(ctx, &pb.GameFavoritesRequest{Uid: &uid, Sid: &sid}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	users.EXPECT().Check(gomock.Any(), uid, gomock.Any(), gomock.Any()).Return(nil).AnyTimes()
	if out, err := l.GameFavorites(ctx, &pb.GameFavoritesRequest{Uid: &uid, Sid: &sid}); err != nil || len(out.GameIds) != 1 {
		t.Fatal(out, err)
	}
	r := &pb.GameFavoriteSetRequest{Uid: &uid, Sid: &sid, GameId: "AG2", Favorite: proto.Bool(true)}
	if _, err := l.GameFavoriteSet(ctx, r); err != nil || store.uid != uid || !store.selected {
		t.Fatal(err)
	}
	r.Favorite = proto.Bool(false)
	if _, err := l.GameFavoriteSet(ctx, r); err != nil || store.selected {
		t.Fatal(err)
	}
	r.Favorite = nil
	if _, err := l.GameFavoriteSet(ctx, r); !errors.Is(err, xerr.ErrInvalid) {
		t.Fatal(err)
	}
	r.Favorite = proto.Bool(true)
	r.GameId = "UNKNOWN"
	if _, err := l.GameFavoriteSet(ctx, r); !errors.Is(err, xerr.ErrInvalid) {
		t.Fatal(err)
	}
	r.GameId = "AG2"
	store.setErr = errors.New("offline")
	if _, err := l.GameFavoriteSet(ctx, r); err == nil {
		t.Fatal("write failure hidden")
	}
	store.setErr = nil
	store.listErr = errors.New("offline")
	if _, err := l.GameFavoriteSet(ctx, r); err == nil {
		t.Fatal("read failure hidden")
	}
	if _, err := l.GameFavorites(ctx, &pb.GameFavoritesRequest{Uid: &uid, Sid: &sid}); err == nil {
		t.Fatal("read failure hidden")
	}
}
