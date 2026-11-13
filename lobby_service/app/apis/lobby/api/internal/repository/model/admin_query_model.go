package model

import (
	"context"
	"errors"
	"gorm.io/gorm"
	"time"
)

type AdminQueryModel struct{ DB *gorm.DB }
type AdminListCriteria struct {
	Query    string
	BeforeID int64
	Limit    int
}
type AdminOrderCriteria struct {
	Kind, Status, Query string
	BeforeTime          time.Time
	BeforeID            string
	Limit               int
}
type AdminOverview struct {
	RealMembers        int64  `json:"realMembers"`
	ExperienceMembers  int64  `json:"experienceMembers"`
	RealBet            string `json:"realBet"`
	RealWin            string `json:"realWin"`
	ExperienceBet      string `json:"experienceBet"`
	ExperienceWin      string `json:"experienceWin"`
	Members            int64  `json:"members"`
	PendingDeposits    int64  `json:"pendingDeposits"`
	PendingWithdrawals int64  `json:"pendingWithdrawals"`
	TodayDeposits      string `json:"todayDeposits"`
	TodayWithdrawals   string `json:"todayWithdrawals"`
}
type AdminAccount struct {
	Channel string `json:"channel"`
	Account string `json:"account"`
	Name    string `json:"name"`
}
type AdminLedger struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	Amount    string    `json:"amount"`
	Balance   string    `json:"balance"`
	CreatedAt time.Time `json:"createdAt"`
}
type AdminAudit struct {
	ID        string    `json:"id"`
	Username  string    `json:"username"`
	Action    string    `json:"action"`
	Target    string    `json:"target"`
	Reason    string    `json:"reason"`
	CreatedAt time.Time `json:"createdAt"`
}
type AdminMemberDetail struct {
	Member    AdminMember
	Remaining int64
	Accounts  []AdminAccount
	Ledger    []AdminLedger
}
type AdminMember struct {
	UID         string     `json:"uid"`
	Account     string     `json:"account"`
	Nickname    string     `json:"nickname"`
	AvatarID    int32      `json:"avatarId"`
	VIPLevel    int32      `json:"vipLevel"`
	Coins       string     `json:"coins"`
	CreatedAt   time.Time  `json:"createdAt"`
	LastLoginAt *time.Time `json:"lastLoginAt"`
}

type AdminOrder struct {
	OrderID      string     `json:"orderId"`
	UID          string     `json:"uid"`
	Kind         string     `json:"kind"`
	Status       string     `json:"status"`
	Amount       string     `json:"amount"`
	Fee          string     `json:"fee"`
	Bonus        string     `json:"bonus"`
	CreditAmount string     `json:"creditAmount"`
	Channel      string     `json:"channel"`
	Account      string     `json:"account"`
	Name         string     `json:"name"`
	CreatedAt    time.Time  `json:"createdAt"`
	SettledAt    *time.Time `json:"settledAt"`
}

func (m AdminQueryModel) Overview(ctx context.Context, now time.Time, loc *time.Location) (AdminOverview, error) {
	if loc == nil {
		loc = time.UTC
	}
	local := now.In(loc)
	start := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, loc)
	end := start.AddDate(0, 0, 1)
	var v AdminOverview
	e := m.DB.WithContext(ctx).Raw(`SELECT
 (SELECT coalesce(sum(members),0) FROM lobby_admin_member_totals) members,
 (SELECT coalesce(sum(members),0) FROM lobby_admin_member_totals WHERE account_type='real') real_members,
 (SELECT coalesce(sum(members),0) FROM lobby_admin_member_totals WHERE account_type='experience') experience_members,
 (SELECT coalesce(sum(bet_amount),0)::text FROM lobby_admin_game_totals WHERE account_type='real') real_bet,
 (SELECT coalesce(sum(win_amount),0)::text FROM lobby_admin_game_totals WHERE account_type='real') real_win,
 (SELECT coalesce(sum(bet_amount),0)::text FROM lobby_admin_game_totals WHERE account_type='experience') experience_bet,
 (SELECT coalesce(sum(win_amount),0)::text FROM lobby_admin_game_totals WHERE account_type='experience') experience_win,
(SELECT count(*) FROM lobby_recharge_orders WHERE status='pending') pending_deposits,(SELECT count(*) FROM lobby_withdrawal_orders WHERE status='pending') pending_withdrawals,(SELECT coalesce(sum(amount),0)::text FROM lobby_recharge_orders WHERE status='success' AND settled_at>=? AND settled_at<?) today_deposits,(SELECT coalesce(sum(amount),0)::text FROM lobby_withdrawal_orders WHERE status='success' AND settled_at>=? AND settled_at<?) today_withdrawals`, start, end, start, end).Scan(&v).Error
	return v, e
}
func (m AdminQueryModel) memberQuery(ctx context.Context) *gorm.DB {
	return m.DB.WithContext(ctx).Table("lobby_users u").Select("u.uid::text uid,coalesce(u.account,'') account,u.nickname,u.avatar_id,coalesce(v.level,0) vip_level,w.coins::text coins,u.created_at,(SELECT max(created_at) FROM lobby_sessions s WHERE s.uid=u.uid) last_login_at").Joins("JOIN lobby_wallet_balances w ON w.uid=u.uid").Joins("LEFT JOIN lobby_vip_states v ON v.uid=u.uid")
}
func (m AdminQueryModel) Members(ctx context.Context, c AdminListCriteria) ([]AdminMember, error) {
	q := m.memberQuery(ctx)
	if c.BeforeID > 0 {
		q = q.Where("u.uid<?", c.BeforeID)
	}
	if c.Query != "" {
		q = q.Where("u.uid::text=? OR u.account ILIKE ? OR u.nickname ILIKE ?", c.Query, "%"+c.Query+"%", "%"+c.Query+"%")
	}
	rows := []AdminMember{}
	e := q.Order("u.uid DESC").Limit(c.Limit + 1).Scan(&rows).Error
	return rows, e
}
func (m AdminQueryModel) Member(ctx context.Context, id int64) (AdminMemberDetail, error) {
	v := AdminMemberDetail{Accounts: []AdminAccount{}, Ledger: []AdminLedger{}}
	if e := m.memberQuery(ctx).Where("u.uid=?", id).Scan(&v.Member).Error; e != nil {
		return v, e
	}
	if v.Member.UID == "" {
		return v, gorm.ErrRecordNotFound
	}
	var e error
	v.Remaining, e = (&TurnoverModel{DB: m.DB}).Remaining(ctx, id)
	if e != nil {
		return v, e
	}
	if e = m.DB.WithContext(ctx).Table("lobby_payout_accounts").Select("channel,account,name").Where("uid=?", id).Scan(&v.Accounts).Error; e != nil {
		return v, e
	}
	e = m.DB.WithContext(ctx).Table("lobby_coin_ledger").Select("id::text id,source type,delta::text amount,balance_after::text balance,created_at").Where("uid=?", id).Order("id DESC").Limit(100).Scan(&v.Ledger).Error
	return v, e
}
func (m AdminQueryModel) Orders(ctx context.Context, c AdminOrderCriteria) ([]AdminOrder, error) {
	table := "lobby_recharge_orders"
	fields := "order_id,uid::text uid,status,amount::text amount,fee::text fee,bonus::text bonus,credit_amount::text credit_amount,'' channel,'' account,'' name,created_at,settled_at"
	switch c.Kind {
	case "deposit":
	case "withdrawal":
		table = "lobby_withdrawal_orders"
		fields = "order_id,uid::text uid,status,amount::text amount,fee::text fee,bonus::text bonus,(amount-fee)::text credit_amount,channel,account,name,created_at,settled_at"
	default:
		return nil, errors.New("invalid admin order kind")
	}
	q := m.DB.WithContext(ctx).Table(table).Select(fields)
	if c.Status != "" {
		q = q.Where("status=?", c.Status)
	}
	if c.Query != "" {
		q = q.Where("uid::text=? OR order_id=?", c.Query, c.Query)
	}
	if !c.BeforeTime.IsZero() {
		q = q.Where("(created_at,order_id)<(?,?)", c.BeforeTime, c.BeforeID)
	}
	rows := []AdminOrder{}
	e := q.Order("created_at DESC,order_id DESC").Limit(c.Limit + 1).Scan(&rows).Error
	for i := range rows {
		rows[i].Kind = c.Kind
	}
	return rows, e
}
func (m AdminQueryModel) Audit(ctx context.Context, c AdminListCriteria) ([]AdminAudit, error) {
	q := m.DB.WithContext(ctx).Table("lobby_admin_audits").Select("id::text id,username,action,target,reason,created_at")
	if c.BeforeID > 0 {
		q = q.Where("id<?", c.BeforeID)
	}
	if c.Query != "" {
		q = q.Where("username ILIKE ? OR target ILIKE ? OR action ILIKE ?", "%"+c.Query+"%", "%"+c.Query+"%", "%"+c.Query+"%")
	}
	rows := []AdminAudit{}
	e := q.Order("id DESC").Limit(c.Limit + 1).Scan(&rows).Error
	return rows, e
}
