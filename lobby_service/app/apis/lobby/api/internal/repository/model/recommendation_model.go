package model

import (
	"context"
	"math"
	"sort"
	"time"

	"gorm.io/gorm"
)

const recommendationWindow = 30 * 24 * time.Hour

// RecommendationRow is the precomputed result consumed by the HTTP API.
type RecommendationRow struct {
	GameID       string
	Score        float64
	SupportUsers int64
}

type RecommendationModel struct{ DB *gorm.DB }

type recommendationFavorite struct {
	UID    int64  `gorm:"column:uid"`
	GameID string `gorm:"column:game_id"`
}

type recommendationPlay struct {
	UID        int64     `gorm:"column:uid"`
	GameID     string    `gorm:"column:game_id"`
	Rounds     int64     `gorm:"column:rounds"`
	ActiveDays int64     `gorm:"column:active_days"`
	LastPlayed time.Time `gorm:"column:last_played"`
}

// List reads only materialized recommendations. source is "*" for favorites
// and the current game ID for game_play.
func (m *RecommendationModel) List(ctx context.Context, uid int64, scene, source string) ([]RecommendationRow, error) {
	if m == nil || m.DB == nil || uid <= 0 || (scene != "favorites" && scene != "game_play") || source == "" {
		return []RecommendationRow{}, nil
	}
	owner := uid
	if scene == "game_play" {
		owner = 0
	}
	read := func(userID int64, limit int) ([]RecommendationRow, error) {
		var rows []RecommendationRow
		err := m.DB.WithContext(ctx).Table("lobby_game_recommendation_edges").
			Select("target_game_id AS game_id, score, support_users").
			Where("scene = ? AND user_id = ? AND source_game_id = ?", scene, userID, source).
			Order("score DESC, support_users DESC, target_game_id ASC").Limit(limit).Scan(&rows).Error
		return rows, err
	}
	rows, err := read(owner, 12)
	if err != nil || scene != "favorites" || len(rows) > 0 {
		return rows, err
	}
	// A user with no favorites, or no matching active users, falls back to the
	// global 30-day play ranking. The larger read limit lets the API remove
	// games the user already owns before returning the first twelve.
	return read(0, 48)
}

// Rebuild recalculates the 30-day recommendation window. It deliberately
// uses completed play records rather than wager amounts: free play is valid
// play behavior too. Experience accounts are excluded by account_type.
func (m *RecommendationModel) Rebuild(ctx context.Context, now time.Time) error {
	if m == nil || m.DB == nil {
		return nil
	}
	since := now.UTC().Add(-recommendationWindow)
	return m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Exec("SELECT pg_advisory_xact_lock(2026112107)").Error; err != nil {
			return err
		}
		var activeIDs []int64
		if err := tx.Raw(`SELECT DISTINCT uid FROM (
 SELECT uid FROM lobby_game_completions WHERE started_at >= ? AND account_type = 'real'
 UNION
 SELECT f.uid FROM lobby_game_favorites f JOIN lobby_users u ON u.uid = f.uid
 WHERE f.created_at >= ? AND u.account_type = 'real'
 ) active`, since, since).Scan(&activeIDs).Error; err != nil {
			return err
		}
		active := make(map[int64]struct{}, len(activeIDs))
		for _, uid := range activeIDs {
			active[uid] = struct{}{}
		}
		var favorites []recommendationFavorite
		if err := tx.Raw("SELECT uid, game_id FROM lobby_game_favorites").Scan(&favorites).Error; err != nil {
			return err
		}
		favoriteSets := make(map[int64]map[string]struct{}, len(active))
		favoriteUsersByGame := map[string]map[int64]struct{}{}
		for _, row := range favorites {
			if _, ok := active[row.UID]; !ok {
				continue
			}
			set := favoriteSets[row.UID]
			if set == nil {
				set = map[string]struct{}{}
				favoriteSets[row.UID] = set
			}
			if _, exists := set[row.GameID]; exists {
				continue
			}
			set[row.GameID] = struct{}{}
			users := favoriteUsersByGame[row.GameID]
			if users == nil {
				users = map[int64]struct{}{}
				favoriteUsersByGame[row.GameID] = users
			}
			users[row.UID] = struct{}{}
		}
		var plays []recommendationPlay
		if err := tx.Raw(`SELECT uid, game_id, COUNT(*) AS rounds,
 COUNT(DISTINCT (started_at AT TIME ZONE 'UTC')::date) AS active_days,
 MAX(ended_at) AS last_played
 FROM lobby_game_completions
 WHERE started_at >= ? AND account_type = 'real'
 GROUP BY uid, game_id`, since).Scan(&plays).Error; err != nil {
			return err
		}
		playByUser := map[int64]map[string]recommendationPlay{}
		playersByGame := map[string]map[int64]recommendationPlay{}
		for _, row := range plays {
			if _, ok := active[row.UID]; !ok {
				continue
			}
			if playByUser[row.UID] == nil {
				playByUser[row.UID] = map[string]recommendationPlay{}
			}
			playByUser[row.UID][row.GameID] = row
			if playersByGame[row.GameID] == nil {
				playersByGame[row.GameID] = map[int64]recommendationPlay{}
			}
			playersByGame[row.GameID][row.UID] = row
		}

		if err := tx.Exec("DELETE FROM lobby_game_recommendation_edges").Error; err != nil {
			return err
		}
		// Favorites: build personalized scores from overlapping active users.
		// If that produces nothing, use this user's own 30-day play history.
		// This also covers users with no favorites at all.
		for uid := range active {
			own := favoriteSets[uid]
			scores, support := favoriteScores(uid, own, favoriteSets, favoriteUsersByGame)
			if len(scores) == 0 {
				scores, support = playScores(playByUser[uid], own, now)
			}
			if err := writeRecommendationRows(tx, "favorites", uid, "*", scores, support, now); err != nil {
				return err
			}
		}
		// Global fallback for users with no recent play history. It is written
		// once and read only when a personalized row set is unavailable.
		globalScores := map[string]float64{}
		globalSupport := map[string]int64{}
		for _, playsByGame := range playByUser {
			for game, play := range playsByGame {
				globalScores[game] += playPreference(play, now)
				globalSupport[game]++
			}
		}
		if err := writeRecommendationRows(tx, "favorites", 0, "*", globalScores, globalSupport, now); err != nil {
			return err
		}

		// Game page: score other games by actual play intensity among users who
		// played the source game. No favorite data or paid-wager filter is used.
		for source, users := range playersByGame {
			scores := map[string]float64{}
			support := map[string]int64{}
			seedUsers := int64(len(users))
			if seedUsers == 0 {
				continue
			}
			for uid := range users {
				for target, play := range playByUser[uid] {
					if target == source {
						continue
					}
					scores[target] += playPreference(play, now)
					support[target]++
				}
			}
			for target := range scores {
				scores[target] /= float64(seedUsers)
			}
			if err := writeRecommendationRows(tx, "game_play", 0, source, scores, support, now); err != nil {
				return err
			}
		}
		return nil
	})
}

func favoriteScores(uid int64, own map[string]struct{}, sets map[int64]map[string]struct{}, usersByGame map[string]map[int64]struct{}) (map[string]float64, map[string]int64) {
	if len(own) == 0 {
		return nil, nil
	}
	commonByUser := map[int64]int{}
	for game := range own {
		for other := range usersByGame[game] {
			if other != uid {
				commonByUser[other]++
			}
		}
	}
	scores := map[string]float64{}
	support := map[string]int64{}
	for other, common := range commonByUser {
		otherSet := sets[other]
		union := len(own) + len(otherSet) - common
		if union == 0 {
			continue
		}
		similarity := float64(common) / float64(union) * 100
		for game := range otherSet {
			if _, already := own[game]; already {
				continue
			}
			scores[game] += similarity
			support[game]++
		}
	}
	return scores, support
}

func playScores(plays map[string]recommendationPlay, own map[string]struct{}, now time.Time) (map[string]float64, map[string]int64) {
	scores := map[string]float64{}
	support := map[string]int64{}
	for game, play := range plays {
		if _, already := own[game]; already {
			continue
		}
		scores[game] += playPreference(play, now)
		support[game] = 1
	}
	return scores, support
}

func playPreference(play recommendationPlay, now time.Time) float64 {
	preference := math.Min(float64(play.Rounds), 50) + math.Min(float64(play.ActiveDays)*6, 30)
	age := now.UTC().Sub(play.LastPlayed.UTC())
	switch {
	case age <= 3*24*time.Hour:
		preference += 20
	case age <= 7*24*time.Hour:
		preference += 15
	case age <= 14*24*time.Hour:
		preference += 8
	default:
		preference += 3
	}
	return preference
}

func writeRecommendationRows(tx *gorm.DB, scene string, uid int64, source string, scores map[string]float64, support map[string]int64, now time.Time) error {
	type item struct {
		game  string
		score float64
	}
	items := make([]item, 0, len(scores))
	for game, score := range scores {
		if score > 0 && !math.IsNaN(score) && !math.IsInf(score, 0) {
			items = append(items, item{game: game, score: score})
		}
	}
	sort.Slice(items, func(i, j int) bool {
		if items[i].score != items[j].score {
			return items[i].score > items[j].score
		}
		return items[i].game < items[j].game
	})
	limit := 12
	if scene == "favorites" && uid == 0 {
		// Keep extra global candidates so the API can remove a user's existing
		// favorites and still return twelve games.
		limit = 48
	}
	if len(items) > limit {
		items = items[:limit]
	}
	for _, row := range items {
		if err := tx.Exec(`INSERT INTO lobby_game_recommendation_edges(scene,user_id,source_game_id,target_game_id,score,support_users,updated_at) VALUES(?,?,?,?,?,?,?)`, scene, uid, source, row.game, row.score, support[row.game], now.UTC()).Error; err != nil {
			return err
		}
	}
	return nil
}
