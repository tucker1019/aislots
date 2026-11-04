package userservice

import (
	"context"
	"encoding/base64"
	"strings"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
)

type withdrawalStore interface {
	Create(context.Context, int64, string, string, string, string, *config.RechargeTier) (*model.LobbyWithdrawalOrder, error)
	Review(context.Context, int64, string, string, string) (*model.LobbyWithdrawalOrder, error)
	Info(context.Context, int64, string) (*model.LobbyWithdrawalOrder, error)
	CashOrders(context.Context, int64, string, time.Time, time.Time, time.Time, string) ([]model.CashOrderRow, error)
	Remaining(context.Context, int64) (int64, error)
}

func (s *Service) WithdrawalList(ctx context.Context, r *pb.UserRequest) (*pb.WithdrawalTiersReply, error) {
	if e := s.walletSession(ctx, r.GetUid(), r.GetSid()); e != nil {
		return nil, e
	}
	out := &pb.WithdrawalTiersReply{TestMode: s.WithdrawalTestMode, Items: []*pb.WithdrawalTier{}}
	for _, t := range s.WithdrawalTiers {
		out.Items = append(out.Items, &pb.WithdrawalTier{Id: t.ID, Amount: t.Amount, Fee: t.Fee, Bonus: t.Bonus, PayoutAmount: t.Amount - t.Fee})
	}
	return out, nil
}

func (s *Service) withdrawalReply(r *model.LobbyWithdrawalOrder) *pb.WithdrawalOrder {
	result := &pb.WithdrawalOrder{OrderId: r.OrderID, Kind: "withdrawal", TierId: r.TierID, RequestId: r.RequestID, Amount: r.Amount, Fee: r.Fee, Bonus: r.Bonus, CreditAmount: r.Amount - r.Fee, Status: r.Status, Channel: r.Channel, Account: r.Account, Name: r.Name, CreatedAt: r.CreatedAt.UTC().Format(time.RFC3339Nano), TestMode: s.WithdrawalTestMode}
	if r.SettledAt != nil {
		result.SettledAt = r.SettledAt.UTC().Format(time.RFC3339Nano)
	}
	return result
}

func (s *Service) WithdrawalCreate(ctx context.Context, r *pb.WithdrawalRequest) (*pb.WithdrawalOrder, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	if len(r.RequestId) < 16 || len(r.RequestId) > 128 || len(r.Channel) > 64 || len(r.TierId) > 64 {
		return nil, xerr.ErrInvalid
	}
	var tier *config.RechargeTier
	for i := range s.WithdrawalTiers {
		if s.WithdrawalTiers[i].ID == r.TierId {
			tier = &s.WithdrawalTiers[i]
			break
		}
	}
	row, e := s.Withdrawal.Create(ctx, r.GetUid(), Hash(r.GetSid()), r.RequestId, r.Channel, r.TierId, tier)
	if e != nil {
		return nil, e
	}
	return s.withdrawalReply(row), nil
}

func (s *Service) WithdrawalReview(ctx context.Context, r *pb.WithdrawalRequest) (*pb.WithdrawalOrder, error) {
	if !s.WithdrawalTestMode {
		return nil, xerr.ErrWithdrawalTestDisabled
	}
	if r.Decision != "approve" && r.Decision != "return" {
		return nil, xerr.ErrInvalid
	}
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	if len(r.OrderId) > 128 {
		return nil, xerr.ErrInvalid
	}
	row, e := s.Withdrawal.Review(ctx, r.GetUid(), Hash(r.GetSid()), r.OrderId, r.Decision)
	if e != nil {
		return nil, e
	}
	return s.withdrawalReply(row), nil
}

func (s *Service) WithdrawalInfo(ctx context.Context, r *pb.WithdrawalRequest) (*pb.WithdrawalOrder, error) {
	if e := s.walletSession(ctx, r.GetUid(), r.GetSid()); e != nil {
		return nil, e
	}
	if len(r.OrderId) > 128 {
		return nil, xerr.ErrInvalid
	}
	row, e := s.Withdrawal.Info(ctx, r.GetUid(), r.OrderId)
	if e != nil {
		return nil, e
	}
	return s.withdrawalReply(row), nil
}

func (s *Service) CashOrders(ctx context.Context, r *pb.WithdrawalRequest) (*pb.CashOrdersReply, error) {
	if e := s.walletSession(ctx, r.GetUid(), r.GetSid()); e != nil {
		return nil, e
	}
	kind := r.Kind
	if kind == "" {
		kind = "all"
	}
	if kind != "all" && kind != "deposit" && kind != "withdrawal" {
		return nil, xerr.ErrInvalid
	}
	from, e := time.Parse(time.RFC3339Nano, r.From)
	if e != nil {
		return nil, xerr.ErrInvalid
	}
	to, e := time.Parse(time.RFC3339Nano, r.To)
	if e != nil || !to.After(from) || to.Sub(from) > 366*24*time.Hour {
		return nil, xerr.ErrInvalid
	}
	var before time.Time
	id := ""
	if r.Cursor != "" {
		raw, e := base64.RawURLEncoding.DecodeString(r.Cursor)
		if e != nil || len(raw) > 256 {
			return nil, xerr.ErrInvalid
		}
		parts := strings.SplitN(string(raw), "|", 2)
		if len(parts) != 2 {
			return nil, xerr.ErrInvalid
		}
		before, e = time.Parse(time.RFC3339Nano, parts[0])
		if e != nil {
			return nil, xerr.ErrInvalid
		}
		id = parts[1]
	}
	rows, e := s.Withdrawal.CashOrders(ctx, r.GetUid(), kind, from, to, before, id)
	if e != nil {
		return nil, e
	}
	out := &pb.CashOrdersReply{Items: []*pb.WithdrawalOrder{}}
	if len(rows) > 20 {
		rows = rows[:20]
		last := rows[19]
		out.NextCursor = base64.RawURLEncoding.EncodeToString([]byte(last.CreatedAt.UTC().Format(time.RFC3339Nano) + "|" + last.OrderID))
	}
	for _, v := range rows {
		item := &pb.WithdrawalOrder{OrderId: v.OrderID, Kind: v.Kind, Amount: v.Amount, Fee: v.Fee, Bonus: v.Bonus, CreditAmount: v.CreditAmount, Status: v.Status, Channel: v.Channel, Account: v.Account, Name: v.Name, PaymentUrl: v.PaymentURL, TierId: v.TierID, RequestId: v.RequestID, CreatedAt: v.CreatedAt.UTC().Format(time.RFC3339Nano), TestMode: s.WithdrawalTestMode}
		if v.SettledAt != nil {
			item.SettledAt = v.SettledAt.UTC().Format(time.RFC3339Nano)
		}
		out.Items = append(out.Items, item)
	}
	return out, nil
}

func (s *Service) WithdrawalTurnover(ctx context.Context, r *pb.UserRequest) (*pb.WithdrawalTurnoverReply, error) {
	if e := s.walletSession(ctx, r.GetUid(), r.GetSid()); e != nil {
		return nil, e
	}
	if s.Withdrawal == nil {
		return nil, xerr.ErrInvalid
	}
	left, e := s.Withdrawal.Remaining(ctx, r.GetUid())
	if e != nil {
		return nil, e
	}
	return &pb.WithdrawalTurnoverReply{Remaining: left, CanWithdraw: left == 0}, nil
}
