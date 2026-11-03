// Explicit maintenance tool; default mode only reports the number of retained source records.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/model"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	game := flag.String("game", "AG1", "game ID")
	apply := flag.Bool("apply", false, "atomically rebuild aggregates and candidates from retained complete rounds")
	flag.Parse()
	c, e := config.Load()
	if e != nil {
		log.Fatal(e)
	}
	if _, ok := c.Game.Games[*game]; !ok {
		log.Fatal("unknown game")
	}
	db, e := gorm.Open(postgres.Open(c.DatabaseURL), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if e != nil {
		log.Fatal("database unavailable")
	}
	sqlDB, e := db.DB()
	if e != nil {
		log.Fatal(e)
	}
	defer func() { _ = sqlDB.Close() }()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()
	if !*apply {
		var count int64
		if e = db.WithContext(ctx).Model(&model.LobbyGameCompletion{}).Where("game_id=?", *game).Count(&count).Error; e != nil {
			log.Fatal(e)
		}
		fmt.Printf("%s: %d retained completed rounds; no changes (use -apply for rebuild)\n", *game, count)
		return
	}
	if e = (&model.GameModel{DB: db, Location: c.Checkin.Location()}).RebuildStatistics(ctx, *game); e != nil {
		log.Fatal(e)
	}
	fmt.Println("Statistics rebuilt atomically; epoch and wallet unchanged")
}
