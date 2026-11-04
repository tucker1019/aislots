package migrations

import _ "embed"

//go:embed 001_users.sql
var usersSchema string

//go:embed 002_profiles.sql
var profilesSchema string

//go:embed 003_recharges.sql
var rechargeSchema string

//go:embed 004_recharge_payments.sql
var paymentsSchema string

//go:embed 005_checkin.sql
var checkinSchema string

//go:embed 006_returns.sql
var returnsSchema string

//go:embed 007_vip.sql
var vipSchema string

//go:embed 008_newbie_recharge.sql
var newbieSchema string

//go:embed 009_game_integration.sql
var gameSchema string

//go:embed 010_uid_start.sql
var uidSchema string

//go:embed 012_game_statistics.sql
var gameStatisticsSchema string

//go:embed 013_invite.sql
var inviteSchema string

//go:embed 014_invite_chests.sql
var inviteChestSchema string

//go:embed 015_rank_replays.sql
var rankReplaySchema string

//go:embed 016_agents.sql
var agentSchema string

//go:embed 017_wallet_accounts.sql
var payoutSchema string

//go:embed 018_withdrawals.sql
var withdrawalSchema string

//go:embed 019_turnover.sql
var turnoverSchema string

//go:embed 020_bound_account_nickname.sql
var accountNicknameSchema string

//go:embed 021_experience_accounts.sql
var experienceSchema string

// Schema applies initial schema and backward-compatible upgrades in order.
var Schema = usersSchema + "\n" + profilesSchema + "\n" + rechargeSchema + "\n" + paymentsSchema + "\n" + checkinSchema + "\n" + returnsSchema + "\n" + vipSchema + "\n" + newbieSchema + "\n" + gameSchema + "\n" + uidSchema + "\n" + gameStatisticsSchema + "\n" + inviteSchema + "\n" + inviteChestSchema + "\n" + rankReplaySchema + "\n" + agentSchema + "\n" + payoutSchema + "\n" + withdrawalSchema + "\n" + turnoverSchema + "\n" + accountNicknameSchema + "\n" + experienceSchema
