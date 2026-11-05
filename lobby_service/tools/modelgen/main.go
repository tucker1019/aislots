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
	for _, table := range []string{"lobby_experience_schedule", "lobby_experience_accounts", "lobby_turnover_activation", "lobby_turnover_rules", "lobby_turnover_balances", "lobby_turnover_entries", "lobby_withdrawal_orders", "lobby_payout_accounts", "lobby_agent_paths", "lobby_agent_queue", "lobby_agent_days", "lobby_agent_personal", "lobby_agent_claims", "lobby_agent_daily", "lobby_agent_contributions", "lobby_invite_codes", "lobby_invite_relations", "lobby_invite_rewards", "lobby_invite_batches", "lobby_game_statistics_epoch", "lobby_game_completions", "lobby_game_rtp_minutes", "lobby_game_streaks", "lobby_game_streak_days", "lobby_game_rank_candidates", "lobby_game_tickets", "lobby_game_settlements", "lobby_users", "lobby_sessions", "lobby_recharge_orders", "lobby_coin_ledger", "lobby_wallet_balances", "lobby_activity_daily", "lobby_activity_events", "lobby_checkin_claims", "lobby_return_batches", "lobby_return_claims", "lobby_vip_states", "lobby_vip_rewards", "lobby_vip_claim_batches", "lobby_newbie_recharges", "lobby_newbie_recharge_tiers", "lobby_newbie_claim_batches"} {
		if !db.Migrator().HasTable(table) {
			log.Fatalf("run migration first: missing %s", table)
		}
	}
	g := gen.NewGenerator(gen.Config{OutPath: "app/apis/lobby/api/internal/repository/query", ModelPkgPath: "app/apis/lobby/api/internal/repository/model", FieldNullable: true})
	g.WithDataTypeMap(map[string]func(gorm.ColumnType) string{"numeric": func(gorm.ColumnType) string { return "string" }})
	g.UseDB(db)
	g.GenerateModel("lobby_experience_accounts")
	g.GenerateModel("lobby_experience_schedule")
	g.GenerateModel("lobby_turnover_activation")
	g.GenerateModel("lobby_turnover_rules")
	g.GenerateModel("lobby_turnover_balances")
	g.GenerateModel("lobby_turnover_entries")
	g.GenerateModel("lobby_game_statistics_epoch")
	g.GenerateModel("lobby_game_completions")
	g.GenerateModel("lobby_game_rtp_minutes")
	g.GenerateModel("lobby_game_streaks")
	g.GenerateModel("lobby_game_streak_days")
	g.GenerateModel("lobby_game_rank_candidates")
	g.GenerateModel("lobby_game_tickets")
	g.GenerateModel("lobby_game_settlements")
	g.GenerateModel("lobby_invite_codes")
	g.GenerateModel("lobby_invite_relations")
	g.GenerateModel("lobby_invite_rewards")
	g.GenerateModel("lobby_invite_batches")
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
	g.GenerateModel("lobby_agent_paths")
	g.GenerateModel("lobby_agent_queue")
	g.GenerateModel("lobby_agent_days")
	g.GenerateModel("lobby_agent_personal")
	g.GenerateModel("lobby_agent_claims")
	g.GenerateModel("lobby_agent_daily")
	g.GenerateModel("lobby_agent_contributions")
	g.GenerateModel("lobby_payout_accounts")
	g.GenerateModel("lobby_withdrawal_orders")
	g.Execute()
}
