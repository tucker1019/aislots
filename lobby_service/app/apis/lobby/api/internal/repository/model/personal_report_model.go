package model

import (
	"context"
	"database/sql"
	"math/big"
	"time"

	"apps/pkg/coinsource"
	"apps/pkg/xerr"

	"gorm.io/gorm"
)

type PersonalReportView struct {
	Amounts  map[string]int64
	From, To time.Time
	Timezone string
}

// Server-owned calendar boundaries keep all clients on the activity timezone.
func reportBounds(period string, now time.Time, location *time.Location) (time.Time, time.Time) {
	d := now.In(location)
	start := time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, location)
	switch period {
	case "yesterday":
		start = start.AddDate(0, 0, -1)
	case "this_week", "last_week":
		start = start.AddDate(0, 0, -(int(start.Weekday())+6)%7)
		if period == "last_week" {
			start = start.AddDate(0, 0, -7)
		}
	}
	days := 1
	if period == "this_week" || period == "last_week" {
		days = 7
	}
	return start, start.AddDate(0, 0, days)
}

func (m *GameModel) PersonalReport(ctx context.Context, uid int64, period string, now time.Time) (*PersonalReportView, error) {
	location := m.Location
	if location == nil {
		location = time.UTC
	}
	from, to := reportBounds(period, now, location)
	out := &PersonalReportView{Amounts: map[string]int64{}, From: from, To: to, Timezone: location.String()}
	// A single snapshot prevents a concurrent settlement appearing in only half the report.
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var rows []struct {
			Source string
			Amount int64
		}
		if e := tx.Model(&LobbyCoinLedger{}).Select("source, SUM(delta) AS amount").Where("uid = ? AND created_at >= ? AND created_at < ?", uid, from, to).Group("source").Scan(&rows).Error; e != nil {
			return e
		}
		sources := map[string]int64{}
		for _, r := range rows {
			sources[r.Source] = r.Amount
		}
		read := func(s coinsource.Source) int64 { return sources[string(s)] }
		var withdrawn int64
		if e := tx.Model(&LobbyWithdrawalOrder{}).Select("COALESCE(SUM(amount),0)").Where("uid=? AND status='success' AND settled_at>=? AND settled_at<?", uid, from, to).Scan(&withdrawn).Error; e != nil {
			return e
		}
		out.Amounts["withdrawal"] = withdrawn
		out.Amounts["recharge"] = read(coinsource.SourceRechargeCredit)
		out.Amounts["betAmount"] = -read(coinsource.SourceGameBet)
		if out.Amounts["betAmount"] < 0 {
			return xerr.ErrBalanceLimit
		}
		profit := new(big.Int).Add(big.NewInt(read(coinsource.SourceGameWin)), big.NewInt(read(coinsource.SourceGameBet)))
		if !profit.IsInt64() {
			return xerr.ErrBalanceLimit
		}
		out.Amounts["gameProfit"] = profit.Int64()
		mappings := map[string][]coinsource.Source{
			"withdrawalBonus": {coinsource.SourceWithdrawalBonus},
			"commission":      {coinsource.SourceAgentCommission},
			"inviteReward":    {coinsource.SourceInviteReward},
			"rebate":          {coinsource.SourceRebateDaily, coinsource.SourceRebateWeekly, coinsource.SourceRebateMonthly}, "checkin": {coinsource.SourceCheckinReward}, "vipUpgrade": {coinsource.SourceVIPUpgrade}, "vipWeekly": {coinsource.SourceVIPWeekly}, "vipMonthly": {coinsource.SourceVIPMonthly}, "loserReturn": {coinsource.SourceLoserReturn}, "rechargeBonus": {coinsource.SourceRechargeBonus}, "newbieReward": {coinsource.SourceNewbieRecharge},
		}
		net := new(big.Int).Set(profit)
		for key, list := range mappings {
			sum := new(big.Int)
			for _, s := range list {
				sum.Add(sum, big.NewInt(read(s)))
			}
			if !sum.IsInt64() {
				return xerr.ErrBalanceLimit
			}
			out.Amounts[key] = sum.Int64()
			net.Add(net, sum)
		}
		if !net.IsInt64() {
			return xerr.ErrBalanceLimit
		}
		out.Amounts["netProfit"] = net.Int64()
		var valid int64
		if e := tx.Model(&LobbyActivityEvent{}).Select("COALESCE(SUM(COALESCE(valid_bet_amount,amount)),0)").Where("uid = ? AND event_type = ? AND occurred_at >= ? AND occurred_at < ?", uid, EventGameBet, from, to).Scan(&valid).Error; e != nil {
			return e
		}
		out.Amounts["validBet"] = valid
		return nil
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead, ReadOnly: true})
	return out, err
}
