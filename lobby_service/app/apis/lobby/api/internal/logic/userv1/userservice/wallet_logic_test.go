package userservice

import (
	"context"
	"errors"
	"strings"
	"testing"

	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"

	"go.uber.org/mock/gomock"
)

type walletFake struct {
	rows []*model.LobbyPayoutAccount
	err  error
}

func (f *walletFake) Accounts(context.Context, int64) ([]*model.LobbyPayoutAccount, error) {
	return f.rows, f.err
}

func (f *walletFake) SaveAccount(_ context.Context, uid int64, c, a, n string) error {
	if f.err != nil {
		return f.err
	}
	f.rows = []*model.LobbyPayoutAccount{{UID: uid, Channel: c, Account: a, Name: n}}
	return nil
}

func TestWalletAuthValidationAndSave(t *testing.T) {
	s, m := setup(t)
	ctx := context.Background()
	f := &walletFake{}
	s.Wallet = f
	if _, e := s.WalletAccounts(ctx, &pb.UserRequest{}); !errors.Is(e, xerr.ErrSession) {
		t.Fatal(e)
	}
	if _, e := s.WalletAccountSave(ctx, &pb.WalletAccountSaveRequest{}); !errors.Is(e, xerr.ErrSession) {
		t.Fatal(e)
	}
	r := request()
	m.EXPECT().Check(ctx, r.GetUid(), Hash(r.GetSid()), gomock.Any()).Return(xerr.ErrSession)
	if _, e := s.WalletAccounts(ctx, r); !errors.Is(e, xerr.ErrSession) {
		t.Fatal(e)
	}
	m.EXPECT().Check(ctx, r.GetUid(), Hash(r.GetSid()), gomock.Any()).Return(nil).AnyTimes()
	for _, row := range []struct{ c, a, n string }{{"bad", "a", "n"}, {"test1", " ", "n"}, {"test1", "a", ""}, {"test1", "a\n", "n\nx"}, {"test1", strings.Repeat("a", 129), "n"}, {"test1", "a", strings.Repeat("名", 65)}} {
		if _, e := s.WalletAccountSave(ctx, &pb.WalletAccountSaveRequest{Uid: r.Uid, Sid: r.Sid, Channel: row.c, Account: row.a, Name: row.n}); !errors.Is(e, xerr.ErrInvalid) {
			t.Fatal(row, e)
		}
	}
	empty, e := s.WalletAccounts(ctx, r)
	if e != nil || len(empty.Channels) != 2 || empty.Channels[0].Bound {
		t.Fatal(empty, e)
	}
	out, e := s.WalletAccountSave(ctx, &pb.WalletAccountSaveRequest{Uid: r.Uid, Sid: r.Sid, Channel: "test2", Account: " 00123 ", Name: " 李四 "})
	if e != nil || out.Account != "00123" || out.Name != "李四" {
		t.Fatal(out, e)
	}
	list, e := s.WalletAccounts(ctx, r)
	if e != nil || list.Channels[0].Bound || !list.Channels[1].Bound {
		t.Fatal(list, e)
	}
	f.err = errors.New("database unavailable")
	if _, e = s.WalletAccounts(ctx, r); e == nil {
		t.Fatal("expected read error")
	}
	if _, e = s.WalletAccountSave(ctx, &pb.WalletAccountSaveRequest{Uid: r.Uid, Sid: r.Sid, Channel: "test1", Account: "abc", Name: "name"}); e == nil {
		t.Fatal("expected save error")
	}
}
