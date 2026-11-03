package main

import (
	"log"
	"os"

	"github.com/jackc/pgx/v5"
	"gorm.io/driver/postgres"
	"gorm.io/gen"
	"gorm.io/gorm"
)

func main() {
	url := os.Getenv("LOBBY_DATABASE_URL")
	c, err := pgx.ParseConfig(url)
	if err != nil || url == "" || c.Database != "aislots_lobby" {
		log.Fatal("LOBBY_DATABASE_URL must point to aislots_lobby")
	}
	db, err := gorm.Open(postgres.Open(url), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}
	for _, table := range []string{"lobby_game_tickets", "lobby_game_settlements", "lobby_users", "lobby_sessions", "lobby_recharge_orders", "lobby_coin_ledger", "lobby_wallet_balances", "lobby_activity_daily", "lobby_activity_events", "lobby_checkin_claims", "lobby_return_batches", "lobby_return_claims", "lobby_vip_states", "lobby_vip_rewards", "lobby_vip_claim_batches", "lobby_newbie_recharges", "lobby_newbie_recharge_tiers", "lobby_newbie_claim_batches"} {
		if !db.Migrator().HasTable(table) {
			log.Fatalf("run migration first: missing %s", table)
		}
	}
	g := gen.NewGenerator(gen.Config{OutPath: "app/apis/lobby/api/internal/repository/query", ModelPkgPath: "app/apis/lobby/api/internal/repository/model", FieldNullable: true})
	g.UseDB(db)
	g.GenerateModel("lobby_game_tickets")
	g.GenerateModel("lobby_game_settlements")
	g.GenerateModel("lobby_users")
	g.GenerateModel("lobby_sessions")
	g.GenerateModel("lobby_recharge_orders")
	g.GenerateModel("lobby_coin_ledger")
	g.GenerateModel("lobby_wallet_balances")
	g.GenerateModel("lobby_activity_daily")
	g.GenerateModel("lobby_activity_events")
	g.GenerateModel("lobby_checkin_claims")
	g.GenerateModel("lobby_return_batches")
	g.GenerateModel("lobby_return_claims")
	g.GenerateModel("lobby_vip_states")
	g.GenerateModel("lobby_vip_rewards")
	g.GenerateModel("lobby_vip_claim_batches")
	g.GenerateModel("lobby_newbie_recharges")
	g.GenerateModel("lobby_newbie_recharge_tiers")
	g.GenerateModel("lobby_newbie_claim_batches")
	g.Execute()
}
