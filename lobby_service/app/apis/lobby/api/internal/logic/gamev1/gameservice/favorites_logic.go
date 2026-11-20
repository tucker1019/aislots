package gameservice

import (
	user "apps/app/apis/lobby/api/internal/logic/userv1/userservice"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
	"context"
	"time"
)

func (l *Logic) favoriteAuth(ctx context.Context, uid int64, sid string) error {
	if uid <= 0 || len(sid) != 52 {
		return xerr.ErrSession
	}
	return l.users.Check(ctx, uid, user.Hash(sid), time.Now().UTC())
}

func (l *Logic) GameFavorites(ctx context.Context, r *pb.GameFavoritesRequest) (*pb.GameFavoritesReply, error) {
	if err := l.favoriteAuth(ctx, r.GetUid(), r.GetSid()); err != nil {
		return nil, err
	}
	ids, err := l.favorites.List(ctx, r.GetUid())
	if err != nil {
		return nil, err
	}
	return &pb.GameFavoritesReply{GameIds: ids}, nil
}

func (l *Logic) GameFavoriteSet(ctx context.Context, r *pb.GameFavoriteSetRequest) (*pb.GameFavoritesReply, error) {
	if err := l.favoriteAuth(ctx, r.GetUid(), r.GetSid()); err != nil {
		return nil, err
	}
	game, exists := l.config.Games[r.GameId]
	if r.Favorite == nil || !exists || (r.GetFavorite() && !game.IsVisible()) {
		return nil, xerr.ErrInvalid
	}
	if err := l.favorites.Set(ctx, r.GetUid(), r.GameId, r.GetFavorite()); err != nil {
		return nil, err
	}
	ids, err := l.favorites.List(ctx, r.GetUid())
	if err != nil {
		return nil, err
	}
	return &pb.GameFavoritesReply{GameIds: ids}, nil
}
