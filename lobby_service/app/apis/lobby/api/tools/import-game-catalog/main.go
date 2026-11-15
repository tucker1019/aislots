// Imports the existing frontend catalog into the audited games configuration.
// Dry run by default. Never overwrites an operator draft or an existing field.
package main

import (
	"apps/app/apis/lobby/api/internal/adminconfig"
	"apps/app/apis/lobby/api/internal/repository/model"
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
	"os"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
func run() error {
	apply := flag.Bool("apply", false, "save and publish the merged catalog")
	hideFortuneTigerPlaceholder := flag.Bool("hide-fortune-tiger-placeholder", false, "hide G1017 when launching AG4")
	hideFortuneOxPlaceholder := flag.Bool("hide-fortune-ox-placeholder", false, "hide G1023 when launching AG7")
	enableReleaseGames := flag.Bool("enable-ag1-through-ag8", false, "enable AG1 through AG8 using the release URLs and hide their legacy placeholders")
	path := flag.String("defaults", "etc/games.json", "catalog defaults")
	flag.Parse()
	db, err := gorm.Open(postgres.Open(os.Getenv("LOBBY_DATABASE_URL")), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		return err
	}
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	defer func() { _ = sqlDB.Close() }()
	ctx := context.Background()
	store := model.AdminConfigStore{DB: db}
	row, err := store.Get(ctx, "games", false)
	if err != nil {
		return err
	}
	if row.DraftVersion != 0 {
		return fmt.Errorf("游戏入口存在未发布草稿，先在后台处理后再迁移")
	}
	seed, err := os.ReadFile(*path)
	if err != nil {
		return err
	}
	next, err := adminconfig.MergeGameCatalog(row.Published, seed)
	if err != nil {
		return err
	}
	if *enableReleaseGames || *hideFortuneTigerPlaceholder || *hideFortuneOxPlaceholder {
		var doc map[string]json.RawMessage
		var games map[string]map[string]json.RawMessage
		if err = json.Unmarshal(next, &doc); err != nil {
			return err
		}
		if err = json.Unmarshal(doc["games"], &games); err != nil {
			return err
		}
		if *enableReleaseGames {
			if err = activateReleaseGames(games, seed); err != nil {
				return err
			}
		}
		for _, migration := range []struct {
			enabled      bool
			current, old string
		}{
			{*hideFortuneTigerPlaceholder, "AG4", "G1017"},
			{*hideFortuneOxPlaceholder, "AG7", "G1023"},
		} {
			if !migration.enabled {
				continue
			}
			active := games[migration.current]
			if string(active["enabled"]) != "true" || string(active["visible"]) == "false" {
				return fmt.Errorf("%s 必须启用并显示后才能隐藏 %s", migration.current, migration.old)
			}
			if old := games[migration.old]; old != nil {
				fmt.Printf("目录更新：隐藏同名旧入口 %s\n", migration.old)
				old["visible"] = json.RawMessage("false")
			}
		}
		doc["games"], err = json.Marshal(games)
		if err != nil {
			return err
		}
		next, err = json.Marshal(doc)
		if err != nil {
			return err
		}
		if err = adminconfig.ValidateDocument("games", next); err != nil {
			return err
		}
	}
	var normalized any
	if err = json.Unmarshal(row.Published, &normalized); err != nil {
		return err
	}
	prior, _ := json.Marshal(normalized)
	if bytes.Equal(prior, next) {
		fmt.Println("游戏目录已迁入，无需重复发布")
		return nil
	}
	var catalog struct{ Games map[string]json.RawMessage }
	if err = json.Unmarshal(next, &catalog); err != nil {
		return err
	}
	fmt.Printf("游戏目录：%d 项；原已发布版本：%d；保留已有地址、开关与排序\n", len(catalog.Games), row.PublishedVersion)
	if !*apply {
		fmt.Println("检查完成；使用 -apply 保存并发布")
		return nil
	}
	const actor = "catalog-migration"
	reason := "游戏目录迁入后台，保留已有运营配置"
	if *hideFortuneTigerPlaceholder {
		reason = "启用 AG4 Fortune Tiger 并隐藏旧 G1017 入口"
	}
	if *hideFortuneOxPlaceholder {
		reason += "；启用 AG7 Fortune Ox 并隐藏旧 G1023 入口"
	}
	if *enableReleaseGames {
		reason = "发布 AG1 至 AG8 并隐藏同名旧入口"
	}
	if err = store.Draft(ctx, "games", row.Version, next, actor, reason); err != nil {
		return err
	}
	sum := sha256.Sum256(next)
	err = store.Publish(ctx, "games", row.Version+1, 0, rand.Text(), hex.EncodeToString(sum[:]), actor, reason, func(_ model.AdminConfigRow, doc json.RawMessage, _ int64) (json.RawMessage, error) {
		return doc, adminconfig.ValidateDocument("games", doc)
	})
	if err == nil {
		fmt.Printf("游戏目录已发布 v%d，版本和审计已记录\n", row.Version+1)
	}
	return err
}

func activateReleaseGames(games map[string]map[string]json.RawMessage, seed []byte) error {
	var release struct {
		Games map[string]map[string]json.RawMessage
	}
	if err := json.Unmarshal(seed, &release); err != nil {
		return err
	}
	for i, placeholder := range []string{"", "G1024", "G1068", "G1017", "G1018", "G1019", "G1023", "G1048"} {
		id := fmt.Sprintf("AG%d", i+1)
		entry, defaults := games[id], release.Games[id]
		if entry == nil {
			return fmt.Errorf("缺少发布游戏 %s", id)
		}
		for _, field := range []string{"url", "apiUrl"} {
			var value string
			if err := json.Unmarshal(defaults[field], &value); err != nil || value == "" {
				return fmt.Errorf("%s 缺少发布地址 %s", id, field)
			}
			entry[field] = defaults[field]
		}
		entry["enabled"], entry["visible"] = json.RawMessage("true"), json.RawMessage("true")
		if old := games[placeholder]; placeholder != "" && old != nil {
			old["visible"] = json.RawMessage("false")
		}
	}
	return nil
}
