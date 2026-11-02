package rechargeservice

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"strings"
	"time"
	"unicode"

	"apps/app/apis/lobby/api/internal/config"
	userlogic "apps/app/apis/lobby/api/internal/logic/userv1/userservice"
	"apps/app/apis/lobby/api/internal/repository"
	"apps/app/apis/lobby/api/internal/repository/model"
	"apps/app/apis/lobby/api/internal/svc"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
)

type Logic struct {
	users repository.UserStore
	store repository.RechargeStore
	tiers []config.RechargeTier
}

func New(ctx *svc.ServiceContext) *Logic {
	return &Logic{users: ctx.Repo.Users, store: ctx.Repo.Recharge, tiers: ctx.Config.RechargeTiers}
}

func (l *Logic) RechargeList(ctx context.Context, r *pb.RechargeRequest) (*pb.RechargeListReply, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	if err := l.users.Check(ctx, r.GetUid(), userlogic.Hash(r.GetSid()), time.Now().UTC()); err != nil {
		return nil, xerr.Public(err)
	}
	out := &pb.RechargeListReply{Items: []*pb.RechargeTier{}}
	for _, t := range l.tiers {
		out.Items = append(out.Items, &pb.RechargeTier{Id: t.ID, Amount: t.Amount, Bonus: t.Bonus, Fee: t.Fee, CreditAmount: t.CreditAmount()})
	}
	return out, nil
}

func (l *Logic) RechargeCreate(ctx context.Context, r *pb.RechargeRequest) (*pb.RechargeCreateReply, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	if r.TierId == "" || len(r.TierId) > 64 || r.RequestId == "" || len(r.RequestId) > 128 || strings.TrimSpace(r.RequestId) != r.RequestId || strings.ContainsFunc(r.RequestId, unicode.IsControl) {
		return nil, xerr.ErrInvalid
	}
	var tier *config.RechargeTier
	for _, t := range l.tiers {
		if t.ID == r.TierId {
			copy := t
			tier = &copy
			break
		}
	}
	order, err := l.store.CreateRecharge(ctx, r.GetUid(), userlogic.Hash(r.GetSid()), r.RequestId, r.TierId, tier, time.Now().UTC())
	if err != nil {
		return nil, xerr.Public(err)
	}
	return &pb.RechargeCreateReply{OrderId: order.OrderID, PaymentUrl: order.PaymentURL, Status: order.Status}, nil
}

func (l *Logic) RechargeOrderInfo(ctx context.Context, r *pb.RechargeRequest) (*pb.RechargeReply, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	if r.OrderId == "" || len(r.OrderId) > 128 {
		return nil, xerr.ErrInvalid
	}
	order, err := l.store.ReadRechargeOrder(ctx, r.GetUid(), userlogic.Hash(r.GetSid()), r.OrderId, time.Now().UTC())
	if err != nil {
		return nil, xerr.Public(err)
	}
	return orderReply(order), nil
}

type orderCursor struct {
	Time time.Time
	ID   string
}

func (l *Logic) RechargeOrderList(ctx context.Context, r *pb.RechargeRequest) (*pb.RechargeOrdersReply, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	if r.Status != "" && r.Status != "pending" && r.Status != "success" && r.Status != "failed" {
		return nil, xerr.ErrInvalid
	}
	if r.Limit < 0 || r.Limit > 100 {
		return nil, xerr.ErrInvalid
	}
	limit := int(r.Limit)
	if limit == 0 {
		limit = 20
	}
	q := model.OrderQuery{Status: r.Status, Limit: limit}
	if r.Cursor != "" {
		if len(r.Cursor) > 512 {
			return nil, xerr.ErrInvalid
		}
		data, err := base64.RawURLEncoding.DecodeString(r.Cursor)
		if err != nil {
			return nil, xerr.ErrInvalid
		}
		var c orderCursor
		if json.Unmarshal(data, &c) != nil || c.Time.IsZero() || c.ID == "" || len(c.ID) > 128 {
			return nil, xerr.ErrInvalid
		}
		q.BeforeTime = c.Time
		q.BeforeID = c.ID
	}
	orders, err := l.store.ReadRechargeOrders(ctx, r.GetUid(), userlogic.Hash(r.GetSid()), q, time.Now().UTC())
	if err != nil {
		return nil, xerr.Public(err)
	}
	out := &pb.RechargeOrdersReply{Items: []*pb.RechargeReply{}}
	if len(orders) > limit {
		last := orders[limit-1]
		data, _ := json.Marshal(orderCursor{Time: last.CreatedAt, ID: last.OrderID})
		out.NextCursor = base64.RawURLEncoding.EncodeToString(data)
		orders = orders[:limit]
	}
	for _, o := range orders {
		out.Items = append(out.Items, orderReply(o))
	}
	return out, nil
}

func orderReply(o *model.LobbyRechargeOrder) *pb.RechargeReply {
	out := &pb.RechargeReply{OrderId: o.OrderID, RequestId: o.RequestID, TierId: o.TierID, Amount: o.Amount, Bonus: o.Bonus, Fee: o.Fee, CreditAmount: o.CreditAmount, Coins: o.Coins, Status: o.Status, PaymentUrl: o.PaymentURL, FailureCode: o.FailureCode, CreatedAt: o.CreatedAt.UTC().Format(time.RFC3339Nano)}
	if o.SettledAt != nil {
		out.SettledAt = o.SettledAt.UTC().Format(time.RFC3339Nano)
	}
	return out
}
