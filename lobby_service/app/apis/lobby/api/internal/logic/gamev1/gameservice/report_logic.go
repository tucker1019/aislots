package gameservice

import (
	user "apps/app/apis/lobby/api/internal/logic/userv1/userservice"
	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
	"context"
	"time"
)

type reportStore interface {
	PersonalReport(context.Context, int64, string, time.Time) (*model.PersonalReportView, error)
}

func (l *Logic) PersonalReport(ctx context.Context, r *pb.PersonalReportRequest) (*pb.PersonalReportReply, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	if err := l.users.Check(ctx, r.GetUid(), user.Hash(r.GetSid()), time.Now().UTC()); err != nil {
		return nil, xerr.Public(err)
	}
	switch r.Period {
	case "today", "yesterday", "this_week", "last_week":
	default:
		return nil, xerr.ErrInvalid
	}
	store, ok := l.store.(reportStore)
	if !ok {
		return nil, xerr.ErrInvalid
	}
	v, err := store.PersonalReport(ctx, r.GetUid(), r.Period, time.Now().UTC())
	if err != nil {
		return nil, xerr.Public(err)
	}
	out := &pb.PersonalReportReply{From: v.From.Format(time.RFC3339), To: v.To.Format(time.RFC3339), Timezone: v.Timezone, Currency: l.config.Currency, Items: []*pb.ReportMetric{}}
	rows := []struct {
		key, label string
		supported  bool
	}{
		{"recharge", "充值金额", true}, {"withdrawal", "取款金额", false}, {"betAmount", "投注额", true}, {"validBet", "有效投注", true}, {"gameProfit", "游戏输赢", true}, {"rebate", "游戏返水", true}, {"checkin", "签到奖励", true}, {"vipUpgrade", "VIP晋级奖励", true}, {"vipWeekly", "VIP周礼金", true}, {"vipMonthly", "VIP月礼金", true}, {"loserReturn", "亏损返还", true}, {"rechargeBonus", "充值赠送", true}, {"newbieReward", "新手奖励", true}, {"commission", "代理佣金", false}, {"adjustment", "账户调整", false}, {"inviteReward", "邀请奖励", true}, {"netProfit", "净输赢", true},
	}
	for _, row := range rows {
		out.Items = append(out.Items, &pb.ReportMetric{Key: row.key, Label: row.label, Supported: row.supported, Amount: v.Amounts[row.key]})
	}
	return out, nil
}
