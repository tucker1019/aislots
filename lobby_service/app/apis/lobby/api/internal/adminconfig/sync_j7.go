package adminconfig

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/model"
	"apps/app/apis/lobby/api/internal/thirdparty/j7"
	"gorm.io/gorm"
)

var nonAlnumPattern = regexp.MustCompile(`[^A-Za-z0-9_-]+`)

func j7CatalogID(gameCode string) string {
	clean := nonAlnumPattern.ReplaceAllString(strings.TrimSpace(gameCode), "_")
	clean = strings.Trim(clean, "_")
	if clean == "" {
		return ""
	}
	id := "J7_" + clean
	if len(id) > 64 {
		id = id[:64]
	}
	return id
}

// RegisterSync mounts third-party catalog sync endpoints on the admin mux.
func RegisterSync(mux *http.ServeMux, db *gorm.DB, protect func(string, http.HandlerFunc) http.HandlerFunc) {
	mux.HandleFunc("POST /admin/api/configs/games/sync-j7", protect("configs.write", func(w http.ResponseWriter, r *http.Request) {
		store := model.AdminConfigStore{DB: db}
		row, err := store.Get(r.Context(), "games", false)
		if err != nil {
			failure(w, err)
			return
		}
		baseDoc := row.Published
		if row.DraftVersion > 0 && len(row.Draft) > 0 {
			baseDoc = row.Draft
		}
		var current config.GameConfig
		if err := json.Unmarshal(baseDoc, &current); err != nil {
			failure(w, err)
			return
		}
		if current.Games == nil {
			current.Games = map[string]config.GameEntry{}
		}

		client := j7.NewClient(j7.LoadConfigFromEnv())
		categories, err := client.FetchGameCategories(r.Context())
		if err != nil {
			respond(w, 502, nil, "J7_SYNC_FAILED", "拉取三方游戏列表失败："+err.Error())
			return
		}

		maxSort := int32(0)
		for _, g := range current.Games {
			if g.Sort > maxSort {
				maxSort = g.Sort
			}
		}

		added, updated := 0, 0
		for _, cat := range categories {
			provider := strings.TrimSpace(cat.Config.Title)
			if strings.EqualFold(provider, "hot") {
				continue
			}
			if provider == "" {
				provider = "J7"
			}
			for _, item := range cat.Game {
				code := strings.TrimSpace(item.GameCode)
				id := j7CatalogID(code)
				if id == "" {
					continue
				}
				name := strings.TrimSpace(item.GameName)
				if name == "" {
					name = code
				}
				icon := strings.TrimSpace(item.Icon)
				if existing, ok := current.Games[id]; ok {
					existing.Source = "j7"
					existing.ExternalGameID = code
					existing.Provider = provider
					if icon != "" {
						existing.Cover = icon
					}
					if strings.TrimSpace(existing.Name) == "" {
						existing.Name = name
					}
					if strings.TrimSpace(existing.NameEn) == "" {
						existing.NameEn = name
					}
					current.Games[id] = existing
					updated++
					continue
				}
				maxSort += 10
				visible := false
				rtp := 97.0
				maxWin := int64(-1)
				current.Games[id] = config.GameEntry{
					TheoreticalRtp: &rtp,
					Volatility:     "medium",
					MaxWin:         &maxWin,
					Cover:          icon,
					Name:           name,
					NameEn:         name,
					Sort:           maxSort,
					Visible:        &visible,
					Provider:       provider,
					Enabled:        false,
					Source:         "j7",
					ExternalGameID: code,
				}
				added++
			}
		}

		merged, err := json.Marshal(current)
		if err != nil {
			failure(w, err)
			return
		}
		if err := ValidateDocument("games", merged); err != nil {
			invalid(w, err)
			return
		}
		respond(w, 200, map[string]any{
			"document": json.RawMessage(merged),
			"added":    added,
			"updated":  updated,
			"total":    len(current.Games),
		}, "", "")
	}))
}
