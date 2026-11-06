package model

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"math"
	"net/url"
	"time"

	"apps/pkg/coinsource"
	"apps/pkg/xerr"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type AgentQuery struct {
	UID, TargetUID                                int64
	Period, Provider, Scope, Search, Kind, Action string
	Page                                          int
}
type (
	AgentSummary struct{ TeamCount, DirectCount, OtherCount, NewCount, DirectNew, OtherNew, ValidBet, Commission, DirectCommission, OtherCommission, Claimable, BetCount, BettorCount, Profit, FirstDepositCount, FirstDepositAmount, DepositCount, DepositAmount, WithdrawalCount, WithdrawalAmount int64 }
	AgentRow     struct {
		UID                                           int64
		Account, RegisteredAt                         string
		Depth                                         int32
		Children                                      int64
		Provider                                      string
		ValidBet, TeamBet, Commission, Profit, Amount int64
		PaymentType, ClaimID, CreatedAt               string
		Threshold, PerTenThousand                     int64
	}
)

type AgentView struct {
	Summary                                                   AgentSummary
	Items                                                     []AgentRow
	HasMore                                                   bool
	From, To, Timezone, Status, UpdatedAt, InviteURL, Account string
	Providers                                                 []string
}

func agentBounds(period string, now time.Time, loc *time.Location) (time.Time, time.Time) {
	if period == "this_month" || period == "last_month" {
		d := now.In(loc)
		s := time.Date(d.Year(), d.Month(), 1, 0, 0, 0, 0, loc)
		if period == "last_month" {
			s = s.AddDate(0, -1, 0)
		}
		return s, s.AddDate(0, 1, 0)
	}
	return reportBounds(period, now, loc)
}

func (m *AgentModel) resolveTarget(tx *gorm.DB, q AgentQuery) (int64, error) {
	target := q.TargetUID
	if target == 0 {
		target = q.UID
	}
	if target != q.UID {
		var n int64
		if e := tx.Table("lobby_agent_paths").Where("ancestor_uid=? AND descendant_uid=?", q.UID, target).Count(&n).Error; e != nil {
			return 0, e
		}
		if n != 1 {
			return 0, xerr.ErrInvalid
		}
	}
	if q.Search != "" && q.Action != "team" {
		var u LobbyUser
		if e := tx.Where("account=? OR uid::text=?", q.Search, q.Search).Take(&u).Error; e != nil {
			if errors.Is(e, gorm.ErrRecordNotFound) {
				return 0, xerr.ErrInvalid
			}
			return 0, e
		}
		var n int64
		if e := tx.Table("lobby_agent_paths").Where("ancestor_uid=? AND descendant_uid=?", target, u.UID).Count(&n).Error; e != nil {
			return 0, e
		}
		if n != 1 {
			return 0, xerr.ErrInvalid
		}
		target = u.UID
	}
	return target, nil
}

func (m *AgentModel) Query(ctx context.Context, q AgentQuery, now time.Time) (*AgentView, error) {
	loc := m.Location
	if loc == nil {
		loc = time.UTC
	}
	from, to := agentBounds(q.Period, now, loc)
	start, end := from.Format(time.DateOnly), to.Format(time.DateOnly)
	out := &AgentView{Items: []AgentRow{}, Providers: []string{}, From: from.Format(time.RFC3339), To: to.Format(time.RFC3339), Timezone: loc.String(), Status: "settled"}
	if !now.Before(to) {
		out.Status = "settled"
	} else {
		out.Status = "preview"
	}
	for p := range m.Config.Providers {
		out.Providers = append(out.Providers, p)
	}
	// Ensure the code before opening the repeatable-read statistics snapshot.
	// Concurrent invite requests may insert the same UID: ON CONFLICT is safe at
	// read committed, but inside repeatable read PostgreSQL can return SQLSTATE 40001.
	if q.Action == "center" {
		var code LobbyInviteCode
		lookup := m.DB.WithContext(ctx).Where("uid=?", q.UID).Take(&code).Error
		if errors.Is(lookup, gorm.ErrRecordNotFound) {
			lookup = m.DB.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&LobbyInviteCode{UID: q.UID, Code: rand.Text()}).Error
		}
		if lookup != nil {
			return nil, lookup
		}
	}
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		target, e := m.resolveTarget(tx, q)
		if e != nil {
			return e
		}
		var user LobbyUser
		if e = tx.Where("uid=?", target).Take(&user).Error; e != nil {
			return e
		}
		out.Account = user.Nickname
		if user.Account != nil {
			out.Account = *user.Account
		}
		scope := func(db *gorm.DB) *gorm.DB {
			if q.Scope == "direct" {
				return db.Where("p.depth=1")
			}
			if q.Scope == "other" {
				return db.Where("p.depth>1")
			}
			return db
		}
		provider := func(db *gorm.DB) *gorm.DB {
			if q.Provider != "" {
				return db.Where("provider=?", q.Provider)
			}
			return db
		}
		if e = tx.Raw(`SELECT COUNT(*) AS team_count,COUNT(*) FILTER(WHERE depth=1) AS direct_count,COUNT(*) FILTER(WHERE depth>1) AS other_count,COUNT(*) FILTER(WHERE effective_at>=? AND effective_at<?) AS new_count,COUNT(*) FILTER(WHERE depth=1 AND effective_at>=? AND effective_at<?) AS direct_new,COUNT(*) FILTER(WHERE depth>1 AND effective_at>=? AND effective_at<?) AS other_new FROM lobby_agent_paths WHERE ancestor_uid=? AND effective_at<=? AND effective_at<?`, from, to, from, to, from, to, target, now, to).Scan(&out.Summary).Error; e != nil {
			return e
		}
		var money struct{ ValidBet, Commission, DirectCommission, OtherCommission int64 }
		if e = provider(tx.Table("lobby_agent_daily").Select("COALESCE(SUM(team_bet),0) AS valid_bet,COALESCE(SUM(direct_commission+other_commission),0) AS commission,COALESCE(SUM(direct_commission),0) AS direct_commission,COALESCE(SUM(other_commission),0) AS other_commission").Where("uid=? AND business_date>=? AND business_date<?", target, start, end)).Scan(&money).Error; e != nil {
			return e
		}
		out.Summary.ValidBet = money.ValidBet
		out.Summary.Commission = money.Commission
		out.Summary.DirectCommission = money.DirectCommission
		out.Summary.OtherCommission = money.OtherCommission
		if e = tx.Raw(`SELECT COALESCE(SUM(d.direct_commission+d.other_commission),0) FROM lobby_agent_daily d JOIN lobby_agent_days s USING(business_date) WHERE d.uid=? AND d.claim_id IS NULL AND s.status='settled' AND NOT EXISTS(SELECT 1 FROM lobby_agent_queue q WHERE q.business_date=d.business_date)`, q.UID).Scan(&out.Summary.Claimable).Error; e != nil {
			return e
		}
		if e = tx.Raw(`SELECT COALESCE(MAX(updated_at)::text,'') FROM lobby_agent_days WHERE business_date>=? AND business_date<?`, start, end).Scan(&out.UpdatedAt).Error; e != nil {
			return e
		}
		offset := (q.Page - 1) * 20
		switch q.Action {
		case "center":
			var code LobbyInviteCode
			if e = tx.Where("uid=?", q.UID).Take(&code).Error; e != nil {
				return e
			}
			out.InviteURL = code.Code
		case "rates":
			for name, tiers := range m.Config.Providers {
				for _, t := range tiers {
					out.Items = append(out.Items, AgentRow{Provider: name, Threshold: t.Threshold, PerTenThousand: t.Rate})
				}
			}
		case "records":
			var rows []LobbyAgentClaim
			if e = tx.Where("uid=?", q.UID).Order("created_at DESC,claim_id DESC").Limit(21).Offset(offset).Find(&rows).Error; e != nil {
				return e
			}
			for _, r := range rows {
				out.Items = append(out.Items, AgentRow{ClaimID: r.ClaimID, Amount: r.Amount, CreatedAt: r.CreatedAt.Format(time.RFC3339Nano)})
			}
		case "team":
			db := tx.Table("lobby_agent_paths p").Select(`u.uid,COALESCE(u.account,u.nickname) AS account,to_char(u.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS registered_at,p.depth,(SELECT COUNT(*) FROM lobby_invite_relations r WHERE r.inviter_uid=u.uid) AS children`).Joins("JOIN lobby_users u ON u.uid=p.descendant_uid").Where("p.ancestor_uid=?", target)
			if q.Search != "" {
				db = db.Where("u.uid::text=? OR u.account=?", q.Search, q.Search)
			} else {
				db = db.Where("p.depth=1")
			}
			if e = db.Order("u.created_at DESC,u.uid DESC").Limit(21).Offset(offset).Scan(&out.Items).Error; e != nil {
				return e
			}
		case "performance":
			if e = provider(tx.Table("lobby_agent_daily").Select("provider,SUM(team_bet) AS valid_bet,SUM(direct_commission+other_commission) AS commission").Where("uid=? AND business_date>=? AND business_date<?", target, start, end)).Group("provider").Order("provider").Scan(&out.Items).Error; e != nil {
				return e
			}
			// Configured providers remain visible even before their first wager.
			for p := range m.Config.Providers {
				if q.Provider != "" && q.Provider != p {
					continue
				}
				found := false
				for _, r := range out.Items {
					if r.Provider == p {
						found = true
					}
				}
				if !found {
					out.Items = append(out.Items, AgentRow{Provider: p})
				}
			}
		case "performance-details":
			db := tx.Table("lobby_agent_contributions c").Select(`c.member_uid AS uid,COALESCE(u.account,u.nickname) AS account,MIN(c.depth) AS depth,SUM(c.valid_bet) AS valid_bet,SUM(c.commission) AS commission`).Joins("JOIN lobby_users u ON u.uid=c.member_uid").Where("c.uid=? AND c.business_date>=? AND c.business_date<?", target, start, end)
			if q.Provider != "" {
				db = db.Where("c.provider=?", q.Provider)
			}
			if q.Scope == "direct" {
				db = db.Where("c.depth=1")
			}
			if q.Scope == "other" {
				db = db.Where("c.depth>1")
			}
			if e = db.Group("c.member_uid,u.account,u.nickname").Order("c.member_uid").Limit(21).Offset(offset).Scan(&out.Items).Error; e != nil {
				return e
			}
		case "report", "report-details":
			base := scope(tx.Table("lobby_agent_personal a").Joins("JOIN lobby_agent_paths p ON p.descendant_uid=a.uid").Where("p.ancestor_uid=? AND a.business_date>=? AND a.business_date<?", target, start, end))
			if q.Provider != "" {
				base = base.Where("a.provider=?", q.Provider)
			}
			var totals struct{ BetCount, BettorCount, Profit int64 }
			if e = base.Select("COALESCE(SUM(a.bet_count),0) AS bet_count,COUNT(DISTINCT a.uid) FILTER(WHERE a.bet_count>0) AS bettor_count,COALESCE(SUM(a.win_amount-a.bet_amount),0) AS profit").Scan(&totals).Error; e != nil {
				return e
			}
			out.Summary.BetCount = totals.BetCount
			out.Summary.BettorCount = totals.BettorCount
			out.Summary.Profit = totals.Profit
			deposit := scope(tx.Table("lobby_recharge_orders o").Joins("JOIN lobby_agent_paths p ON p.descendant_uid=o.uid").Where("p.ancestor_uid=? AND o.status='success' AND COALESCE(o.settled_at,o.created_at)>=? AND COALESCE(o.settled_at,o.created_at)<? AND COALESCE(o.settled_at,o.created_at)>=p.effective_at AND COALESCE(o.settled_at,o.created_at)<=?", target, from, to, now))
			first := `NOT EXISTS(SELECT 1 FROM lobby_recharge_orders old WHERE old.uid=o.uid AND old.status='success' AND (COALESCE(old.settled_at,old.created_at),old.order_id)<(COALESCE(o.settled_at,o.created_at),o.order_id))`
			var deposits struct{ DepositCount, DepositAmount, FirstDepositCount, FirstDepositAmount int64 }
			if e = deposit.Select("COUNT(DISTINCT o.uid) AS deposit_count,COALESCE(SUM(o.amount),0) AS deposit_amount,COUNT(DISTINCT o.uid) FILTER(WHERE " + first + ") AS first_deposit_count,COALESCE(SUM(o.amount) FILTER(WHERE " + first + "),0) AS first_deposit_amount").Scan(&deposits).Error; e != nil {
				return e
			}
			out.Summary.DepositCount = deposits.DepositCount
			out.Summary.DepositAmount = deposits.DepositAmount
			out.Summary.FirstDepositCount = deposits.FirstDepositCount
			out.Summary.FirstDepositAmount = deposits.FirstDepositAmount
			withdrawals := scope(tx.Table("lobby_withdrawal_orders o").Joins("JOIN lobby_agent_paths p ON p.descendant_uid=o.uid").Where("p.ancestor_uid=? AND o.status='success' AND o.settled_at>=? AND o.settled_at<? AND o.settled_at>=p.effective_at AND o.settled_at<=?", target, from, to, now))
			var withdrawalsTotal struct{ WithdrawalCount, WithdrawalAmount int64 }
			if e = withdrawals.Session(&gorm.Session{}).Select("COUNT(DISTINCT o.uid) AS withdrawal_count,COALESCE(SUM(o.amount),0) AS withdrawal_amount").Scan(&withdrawalsTotal).Error; e != nil {
				return e
			}
			out.Summary.WithdrawalCount = withdrawalsTotal.WithdrawalCount
			out.Summary.WithdrawalAmount = withdrawalsTotal.WithdrawalAmount
			if q.Action == "report" {
				break
			}
			switch q.Kind {
			case "withdrawal":
				if e = withdrawals.Session(&gorm.Session{}).Joins("JOIN lobby_users u ON u.uid=o.uid").Select("u.uid,COALESCE(u.account,u.nickname) AS account,p.depth,SUM(o.amount) AS amount").Group("u.uid,u.account,u.nickname,p.depth").Order("u.uid").Limit(21).Offset(offset).Scan(&out.Items).Error; e != nil {
					return e
				}
			case "deposit", "first-deposit":
				rows := scope(tx.Table("lobby_recharge_orders o").Joins("JOIN lobby_agent_paths p ON p.descendant_uid=o.uid").Joins("JOIN lobby_users u ON u.uid=o.uid").Where("p.ancestor_uid=? AND o.status='success' AND COALESCE(o.settled_at,o.created_at)>=? AND COALESCE(o.settled_at,o.created_at)<? AND COALESCE(o.settled_at,o.created_at)>=p.effective_at AND COALESCE(o.settled_at,o.created_at)<=?", target, from, to, now))
				if q.Kind == "first-deposit" {
					rows = rows.Where(first)
				}
				if e = rows.Select("u.uid,COALESCE(u.account,u.nickname) AS account,p.depth,SUM(o.amount) AS amount").Group("u.uid,u.account,u.nickname,p.depth").Order("u.uid").Limit(21).Offset(offset).Scan(&out.Items).Error; e != nil {
					return e
				}
				for i := range out.Items {
					out.Items[i].PaymentType = "test"
				}
			case "team", "bets":
				rows := scope(tx.Table("lobby_agent_paths p").Joins("JOIN lobby_users u ON u.uid=p.descendant_uid").Where("p.ancestor_uid=? AND p.effective_at<? AND p.effective_at<=?", target, to, now))
				filter := ""
				args := []any{start, end}
				if q.Provider != "" {
					filter = " AND provider=?"
					args = append(args, q.Provider)
				}
				selectSQL := `u.uid,COALESCE(u.account,u.nickname) AS account,to_char(u.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS registered_at,p.depth,COALESCE((SELECT SUM(valid_bet) FROM lobby_agent_personal WHERE uid=u.uid AND business_date>=? AND business_date<?` + filter + `),0) AS valid_bet`
				selectSQL += `,COALESCE((SELECT SUM(win_amount-bet_amount) FROM lobby_agent_personal WHERE uid=u.uid AND business_date>=? AND business_date<?` + filter + `),0) AS profit`
				args = append(args, args...)
				teamArgs := []any{start, end}
				if q.Provider != "" {
					teamArgs = append(teamArgs, q.Provider)
				}
				selectSQL += `,COALESCE((SELECT SUM(team_bet) FROM lobby_agent_daily WHERE uid=u.uid AND business_date>=? AND business_date<?` + filter + `),0) AS team_bet`
				args = append(args, teamArgs...)
				if q.Kind == "team" {
					rows = rows.Where("p.depth=1")
				}
				if q.Kind == "bets" {
					exists := tx.Table("lobby_agent_personal activity").Select("1").Where("activity.uid=u.uid AND activity.business_date>=? AND activity.business_date<? AND (activity.bet_count>0 OR activity.win_amount>0)", start, end)
					if q.Provider != "" {
						exists = exists.Where("activity.provider=?", q.Provider)
					}
					rows = rows.Where("EXISTS (?)", exists)
				}
				if e = rows.Select(selectSQL, args...).Order("u.uid").Limit(21).Offset(offset).Scan(&out.Items).Error; e != nil {
					return e
				}
			}
		}
		if len(out.Items) > 20 && q.Action != "rates" && q.Action != "performance" {
			out.HasMore = true
			out.Items = out.Items[:20]
		}
		return nil
	}, &sql.TxOptions{Isolation: sql.LevelRepeatableRead})
	return out, err
}

func (m *AgentModel) Claim(ctx context.Context, uid int64, id string, now time.Time) (*LobbyAgentClaim, error) {
	var receipt LobbyAgentClaim
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var w LobbyWalletBalance
		if e := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid=?", uid).Take(&w).Error; e != nil {
			return e
		}
		e := tx.Where("uid=? AND request_id=?", uid, id).Take(&receipt).Error
		if e == nil {
			return nil
		}
		if !errors.Is(e, gorm.ErrRecordNotFound) {
			return e
		}
		if e = tx.Exec(`SELECT pg_advisory_xact_lock(20261104)`).Error; e != nil {
			return e
		}
		var total int64
		eligible := `uid=? AND claim_id IS NULL AND business_date IN (SELECT business_date FROM lobby_agent_days d WHERE status='settled' AND NOT EXISTS(SELECT 1 FROM lobby_agent_queue q WHERE q.business_date=d.business_date))`
		if e = tx.Table("lobby_agent_daily").Select("COALESCE(SUM(direct_commission+other_commission),0)").Where(eligible, uid).Scan(&total).Error; e != nil {
			return e
		}
		if total <= 0 {
			return xerr.ErrReturnEmpty
		}
		if w.Coins > math.MaxInt64-total {
			return xerr.ErrBalanceLimit
		}
		receipt = LobbyAgentClaim{ClaimID: "agt_" + rand.Text(), UID: uid, RequestID: id, Amount: total, Coins: w.Coins + total, CreatedAt: now}
		if e = tx.Create(&receipt).Error; e != nil {
			return e
		}
		if e = tx.Table("lobby_agent_daily").Where(eligible, uid).Update("claim_id", receipt.ClaimID).Error; e != nil {
			return e
		}
		if e = tx.Create(&LobbyCoinLedger{UID: uid, OrderID: receipt.ClaimID, Source: string(coinsource.SourceAgentCommission), Delta: total, BalanceBefore: w.Coins, BalanceAfter: receipt.Coins, CreatedAt: now}).Error; e != nil {
			return e
		}
		return tx.Model(&w).Update("coins", receipt.Coins).Error
	})
	return &receipt, err
}

// InviteURL uses the same permanent invitation code as the existing invite activity.
func AgentInviteURL(base, code string) string {
	u, e := url.Parse(base)
	if e != nil {
		return ""
	}
	q := u.Query()
	q.Set("inviteCode", code)
	u.RawQuery = q.Encode()
	return u.String()
}
