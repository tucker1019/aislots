package userservice

import (
	"context"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
)

func (s *Service) walletSession(ctx context.Context, uid int64, sid string) error {
	if uid <= 0 || len(sid) != 52 {
		return xerr.ErrSession
	}
	return s.Store.Check(ctx, uid, Hash(sid), time.Now().UTC())
}

func (s *Service) WalletAccounts(ctx context.Context, r *pb.UserRequest) (*pb.WalletAccountsReply, error) {
	if e := s.walletSession(ctx, r.GetUid(), r.GetSid()); e != nil {
		return nil, e
	}
	rows, e := s.Wallet.Accounts(ctx, r.GetUid())
	if e != nil {
		return nil, e
	}
	result := &pb.WalletAccountsReply{}
	for _, channel := range []string{"test1", "test2"} {
		item := &pb.WalletAccountReply{Channel: channel}
		for _, row := range rows {
			if row.Channel == channel {
				item.Account = row.Account
				item.Name = row.Name
				item.Bound = true
				break
			}
		}
		result.Channels = append(result.Channels, item)
	}
	return result, nil
}

func (s *Service) WalletAccountSave(ctx context.Context, r *pb.WalletAccountSaveRequest) (*pb.WalletAccountReply, error) {
	if e := s.walletSession(ctx, r.GetUid(), r.GetSid()); e != nil {
		return nil, e
	}
	account, name := strings.TrimSpace(r.Account), strings.TrimSpace(r.Name)
	valid := func(value string, max int) bool {
		return utf8.ValidString(value) && utf8.RuneCountInString(value) > 0 && utf8.RuneCountInString(value) <= max && !strings.ContainsFunc(value, unicode.IsControl)
	}
	if (r.Channel != "test1" && r.Channel != "test2") || !valid(account, 128) || !valid(name, 64) {
		return nil, xerr.ErrInvalid
	}
	if e := s.Wallet.SaveAccount(ctx, r.GetUid(), r.Channel, account, name); e != nil {
		return nil, e
	}
	return &pb.WalletAccountReply{Channel: r.Channel, Account: account, Name: name, Bound: true}, nil
}
