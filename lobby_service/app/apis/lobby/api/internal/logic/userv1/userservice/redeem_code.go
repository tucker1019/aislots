package userservice

import (
	"context"
	"strings"
	"time"

	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
)

func (s *Service) RedeemCode(ctx context.Context, r *pb.RedeemCodeRequest) (*pb.RedeemCodeReply, error) {
	if r.GetUid() < 1 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	code := strings.TrimSpace(r.Code)
	if len(code) < 8 || len(code) > 64 {
		return nil, xerr.ErrRedeemCode
	}
	receipt, err := s.RedeemCodes.Redeem(ctx, r.GetUid(), Hash(r.GetSid()), code, time.Now().UTC())
	if err != nil {
		return nil, xerr.Public(err)
	}
	return &pb.RedeemCodeReply{Amount: receipt.Amount, Coins: receipt.Coins}, nil
}
