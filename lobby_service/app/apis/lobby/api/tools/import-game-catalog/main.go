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
	if *hideFortuneTigerPlaceholder {
		var doc map[string]json.RawMessage
		var games map[string]map[string]json.RawMessage
		if err = json.Unmarshal(next, &doc); err != nil {
			return err
		}
		if err = json.Unmarshal(doc["games"], &games); err != nil {
			return err
		}
		ag4, old := games["AG4"], games["G1017"]
		if string(ag4["enabled"]) != "true" || string(ag4["visible"]) == "false" {
			return fmt.Errorf("AG4 必须启用并显示后才能隐藏 G1017")
		}
		if old != nil {
			fmt.Println("目录更新：隐藏同名旧入口 G1017")
			old["visible"] = json.RawMessage("false")
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
