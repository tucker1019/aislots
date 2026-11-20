package repository

import "context"

type FavoriteStore interface {
	List(context.Context, int64) ([]string, error)
	Set(context.Context, int64, string, bool) error
}
