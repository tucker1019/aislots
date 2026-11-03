package model

import (
	"context"
	"time"
)

func (m *InviteModel) Chests(ctx context.Context, uid int64, page int) ([]LobbyInviteReward, error) {
	rows := []LobbyInviteReward{}
	e := m.DB.WithContext(ctx).Where("inviter_uid = ? AND slot > ? AND slot <= ?", uid, (page-1)*100, page*100).Order("slot").Find(&rows).Error
	return rows, e
}

type InviteFriendRow struct {
	InviteeUID                               int64
	Account                                  string
	RegisteredAt                             time.Time
	DepositCount, DepositAmount, BetAmount   int64
	Qualified                                bool
	RequiredDepositCount                     int32
	RequiredDepositAmount, RequiredBetAmount int64
	DurationDays                             int32
}

func (m *InviteModel) Friends(ctx context.Context, uid int64, page int, now time.Time) ([]InviteFriendRow, error) {
	rows := []InviteFriendRow{}
	e := m.DB.WithContext(ctx).Raw(`SELECT r.invitee_uid,COALESCE(NULLIF(u.account,''),u.nickname) AS account,r.registered_at,
 d.count AS deposit_count,d.amount AS deposit_amount,b.amount AS bet_amount,
 (w.invitee_uid IS NOT NULL OR (d.count>=r.min_deposit_count AND d.amount>=r.min_deposit_amount AND b.amount>=r.min_bet_amount)) AS qualified,
 r.min_deposit_count AS required_deposit_count,r.min_deposit_amount AS required_deposit_amount,r.min_bet_amount AS required_bet_amount,
 (EXTRACT(EPOCH FROM(r.deadline-r.registered_at))/86400)::integer AS duration_days
 FROM lobby_invite_relations r JOIN lobby_users u ON u.uid=r.invitee_uid
 LEFT JOIN lobby_invite_rewards w ON w.invitee_uid=r.invitee_uid
 CROSS JOIN LATERAL(SELECT count(*) AS count,COALESCE(sum(o.amount),0) AS amount FROM lobby_recharge_orders o WHERE o.uid=r.invitee_uid AND o.status='success' AND COALESCE(o.settled_at,o.created_at)>=r.registered_at AND COALESCE(o.settled_at,o.created_at)<r.deadline AND COALESCE(o.settled_at,o.created_at)<=?) d
 CROSS JOIN LATERAL(SELECT COALESCE(sum(e.amount),0) AS amount FROM lobby_activity_events e WHERE e.uid=r.invitee_uid AND e.event_type='game_bet' AND e.occurred_at>=r.registered_at AND e.occurred_at<r.deadline AND e.occurred_at<=?) b
 WHERE r.inviter_uid=? ORDER BY r.registered_at DESC,r.invitee_uid DESC LIMIT 21 OFFSET ?`, now, now, uid, (page-1)*20).Scan(&rows).Error
	return rows, e
}
