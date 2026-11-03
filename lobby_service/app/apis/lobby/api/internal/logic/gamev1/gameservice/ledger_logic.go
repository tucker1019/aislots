package gameservice

import (
	"context"
	"errors"
	"sort"
	"strconv"
	"time"

	user "apps/app/apis/lobby/api/internal/logic/userv1/userservice"
	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/coinsource"
	"apps/pkg/xerr"

	"gorm.io/gorm"
)

type ledgerStore interface {
	Ledger(context.Context, int64, time.Time, time.Time, []string, []string, int64) ([]model.WalletLedgerRow, error)
	LedgerDetail(context.Context, int64, int64) (model.WalletLedgerRow, error)
}
type ledgerCategory struct {
	id, name         string
	sources, gameIDs []string
}

func (l *Logic) ledgerCategories() []ledgerCategory {
	c := []ledgerCategory{
		{"withdrawal", "取款扣款", []string{string(coinsource.SourceWithdrawalDebit)}, nil},
		{"withdrawal-refund", "取款退回", []string{string(coinsource.SourceWithdrawalRefund)}, nil},
		{"withdrawal-bonus", "取款赠送", []string{string(coinsource.SourceWithdrawalBonus)}, nil},
		{"commission", "代理佣金", []string{string(coinsource.SourceAgentCommission)}, nil},
		{"invite", "邀请奖励", []string{string(coinsource.SourceInviteReward)}, nil},
		{"recharge", "会员充值", []string{string(coinsource.SourceRechargeCredit)}, nil},
		{"bonus", "充值赠送", []string{string(coinsource.SourceRechargeBonus)}, nil},
		{"fee", "充值手续费", []string{string(coinsource.SourceRechargeFee)}, nil},
		{"checkin", "签到奖励", []string{string(coinsource.SourceCheckinReward)}, nil},
		{"weekly", "每周礼金", []string{string(coinsource.SourceVIPWeekly)}, nil},
		{"monthly", "每月礼金", []string{string(coinsource.SourceVIPMonthly)}, nil},
		{"upgrade", "晋级奖励", []string{string(coinsource.SourceVIPUpgrade)}, nil},
		{"rebate", "反水奖励", []string{string(coinsource.SourceRebateDaily), string(coinsource.SourceRebateWeekly), string(coinsource.SourceRebateMonthly)}, nil},
		{"loss", "亏损返还", []string{string(coinsource.SourceLoserReturn)}, nil},
		{"newbie", "新手充值奖励", []string{string(coinsource.SourceNewbieRecharge)}, nil},
	}
	providers := map[string][]string{}
	for id, g := range l.config.Games {
		if g.Provider != "" {
			providers[g.Provider] = append(providers[g.Provider], id)
		}
	}
	names := []string{}
	for p := range providers {
		names = append(names, p)
	}
	sort.Strings(names)
	for _, p := range names {
		c = append(c, ledgerCategory{"bet:" + p, p + " 投注", []string{string(coinsource.SourceGameBet)}, providers[p]}, ledgerCategory{"win:" + p, p + " 派彩", []string{string(coinsource.SourceGameWin)}, providers[p]})
	}
	return c
}

func (l *Logic) ledgerItem(r model.WalletLedgerRow) *pb.WalletLedgerItem {
	name := "其他账变"
	for _, c := range l.ledgerCategories() {
		for _, s := range c.sources {
			if s != r.Source {
				continue
			}
			if c.gameIDs != nil {
				matched := false
				for _, id := range c.gameIDs {
					if id == r.GameID {
						matched = true
					}
				}
				if !matched {
					continue
				}
			}
			name = c.name
		}
	}
	return &pb.WalletLedgerItem{Id: strconv.FormatInt(r.ID, 10), OrderId: r.OrderID, Type: name, Currency: l.config.Currency, Amount: r.Delta, Balance: r.BalanceAfter, CreatedAt: r.CreatedAt.UTC().Format(time.RFC3339Nano), Remark: name}
}

func (l *Logic) ledgerAuth(ctx context.Context, r *pb.WalletLedgerRequest) (ledgerStore, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	if e := l.users.Check(ctx, r.GetUid(), user.Hash(r.GetSid()), time.Now().UTC()); e != nil {
		return nil, xerr.Public(e)
	}
	store, ok := l.store.(ledgerStore)
	if !ok {
		return nil, xerr.ErrInvalid
	}
	return store, nil
}

func (l *Logic) WalletLedger(ctx context.Context, r *pb.WalletLedgerRequest) (*pb.WalletLedgerReply, error) {
	store, e := l.ledgerAuth(ctx, r)
	if e != nil {
		return nil, e
	}
	from, e := time.Parse(time.RFC3339, r.From)
	if e != nil {
		return nil, xerr.ErrInvalid
	}
	to, e := time.Parse(time.RFC3339, r.To)
	if e != nil || !to.After(from) || to.Sub(from) > 32*24*time.Hour {
		return nil, xerr.ErrInvalid
	}
	var cursor int64
	if r.Cursor != "" {
		cursor, e = strconv.ParseInt(r.Cursor, 10, 64)
		if e != nil || cursor < 1 {
			return nil, xerr.ErrInvalid
		}
	}
	categories := l.ledgerCategories()
	var sources, gameIDs []string
	if r.Category != "" {
		found := false
		for _, c := range categories {
			if c.id == r.Category {
				found = true
				sources = c.sources
				gameIDs = c.gameIDs
			}
		}
		if !found {
			return nil, xerr.ErrInvalid
		}
	}
	rows, e := store.Ledger(ctx, r.GetUid(), from, to, sources, gameIDs, cursor)
	if e != nil {
		return nil, e
	}
	out := &pb.WalletLedgerReply{Items: []*pb.WalletLedgerItem{}, Categories: []*pb.WalletLedgerCategory{}}
	for _, c := range categories {
		out.Categories = append(out.Categories, &pb.WalletLedgerCategory{Id: c.id, Name: c.name})
	}
	if len(rows) > 20 {
		rows = rows[:20]
		out.NextCursor = strconv.FormatInt(rows[19].ID, 10)
	}
	for _, row := range rows {
		out.Items = append(out.Items, l.ledgerItem(row))
	}
	return out, nil
}

func (l *Logic) WalletLedgerDetail(ctx context.Context, r *pb.WalletLedgerRequest) (*pb.WalletLedgerDetailReply, error) {
	store, e := l.ledgerAuth(ctx, r)
	if e != nil {
		return nil, e
	}
	id, e := strconv.ParseInt(r.Id, 10, 64)
	if e != nil || id < 1 {
		return nil, xerr.ErrInvalid
	}
	row, e := store.LedgerDetail(ctx, r.GetUid(), id)
	if errors.Is(e, gorm.ErrRecordNotFound) {
		return nil, xerr.ErrInvalid
	}
	if e != nil {
		return nil, e
	}
	return &pb.WalletLedgerDetailReply{Item: l.ledgerItem(row)}, nil
}
