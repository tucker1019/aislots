package model

import (
	"context"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"time"
)

type GameFavoriteModel struct{ DB *gorm.DB }

func (m *GameFavoriteModel) List(ctx context.Context, uid int64) ([]string, error) {
	ids := []string{}
	err := m.DB.WithContext(ctx).Model(&LobbyGameFavorite{}).Where("uid = ?", uid).Order("created_at DESC, game_id ASC").Pluck("game_id", &ids).Error
	return ids, err
}

func (m *GameFavoriteModel) Set(ctx context.Context, uid int64, gameID string, favorite bool) error {
	if !favorite {
		return m.DB.WithContext(ctx).Where("uid = ? AND game_id = ?", uid, gameID).Delete(&LobbyGameFavorite{}).Error
	}
	row := LobbyGameFavorite{UID: uid, GameID: gameID, CreatedAt: time.Now().UTC()}
	return m.DB.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error
}
