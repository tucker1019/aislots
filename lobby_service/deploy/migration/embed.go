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

// Schema applies initial schema and backward-compatible upgrades in order.
var Schema = usersSchema + "\n" + profilesSchema + "\n" + rechargeSchema + "\n" + paymentsSchema + "\n" + checkinSchema + "\n" + returnsSchema + "\n" + vipSchema + "\n" + newbieSchema
