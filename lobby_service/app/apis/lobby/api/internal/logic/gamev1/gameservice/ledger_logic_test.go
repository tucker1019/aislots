package gameservice

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"

	"gorm.io/gorm"
)

type ledgerFake struct {
	fake
	err     error
	rows    []model.WalletLedgerRow
	sources []string
	games   []string
}

func (f *ledgerFake) Ledger(_ context.Context, _ int64, _, _ time.Time, sources, games []string, _ int64) ([]model.WalletLedgerRow, error) {
	f.sources = sources
	f.games = games
	return f.rows, f.err
}

func (f *ledgerFake) LedgerDetail(context.Context, int64, int64) (model.WalletLedgerRow, error) {
	return f.rows[0], f.err
}

func TestWalletLedgerBusinessTypesAndAuthorization(t *testing.T) {
	ctx := context.Background()
	uid := int64(1)
	sid := strings.Repeat("s", 52)
	f := &ledgerFake{}
	for i := 0; i < 21; i++ {
		f.rows = append(f.rows, model.WalletLedgerRow{LobbyCoinLedger: model.LobbyCoinLedger{ID: int64(100 - i), Source: "game_001", Delta: -100, BalanceAfter: 500, CreatedAt: time.Now()}, GameID: "AG1"})
	}
	l := &Logic{users: recordUsers{}, store: f, config: config.GameConfig{Currency: "IDR", Games: map[string]config.GameEntry{"AG1": {Provider: "AG", Name: "麻将胡了"}}}}
	r := &pb.WalletLedgerRequest{Uid: &uid, Sid: &sid, From: "2026-11-03T00:00:00Z", To: "2026-11-04T00:00:00Z", Category: "bet:AG"}
	out, e := l.WalletLedger(ctx, r)
	if e != nil || len(out.Items) != 20 || out.NextCursor != "81" || out.Items[0].Type != "AG 投注" || len(f.games) != 1 {
		t.Fatal(out, e)
	}
	for _, c := range out.Categories {
		if strings.Contains(c.Name, "三方") || strings.Contains(c.Name, "麻将") {
			t.Fatal(c)
		}
	}
	r.Category = "rebate"
	if _, e = l.WalletLedger(ctx, r); e != nil || len(f.sources) != 3 {
		t.Fatal(f.sources, e)
	}
	r.Category = "bad"
	if _, e = l.WalletLedger(ctx, r); !errors.Is(e, xerr.ErrInvalid) {
		t.Fatal(e)
	}
	r.Category = ""
	for _, cursor := range []string{"bad", "-1"} {
		r.Cursor = cursor
		if _, e = l.WalletLedger(ctx, r); !errors.Is(e, xerr.ErrInvalid) {
			t.Fatal(e)
		}
	}
	r.Cursor = "80"
	if _, e = l.WalletLedger(ctx, r); e != nil {
		t.Fatal(e)
	}
	r.Cursor = ""
	r.From = "bad"
	if _, e = l.WalletLedger(ctx, r); e == nil {
		t.Fatal("date")
	}
	r.From = "2026-11-03T00:00:00Z"
	r.To = "bad"
	if _, e = l.WalletLedger(ctx, r); e == nil {
		t.Fatal("date")
	}
	r.To = "2026-11-04T00:00:00Z"
	f.err = errors.New("db")
	if _, e = l.WalletLedger(ctx, r); e == nil {
		t.Fatal("db")
	}
	f.err = nil
	r.Id = "100"
	detail, e := l.WalletLedgerDetail(ctx, r)
	if e != nil || detail.Item.Type != "AG 投注" {
		t.Fatal(detail, e)
	}
	r.Id = "bad"
	if _, e = l.WalletLedgerDetail(ctx, r); e == nil {
		t.Fatal("id")
	}
	r.Id = "100"
	f.err = gorm.ErrRecordNotFound
	if _, e = l.WalletLedgerDetail(ctx, r); !errors.Is(e, xerr.ErrInvalid) {
		t.Fatal(e)
	}
	f.err = errors.New("db")
	if _, e = l.WalletLedgerDetail(ctx, r); e == nil {
		t.Fatal("db")
	}
	f.err = nil
	if _, e = l.WalletLedger(ctx, &pb.WalletLedgerRequest{}); !errors.Is(e, xerr.ErrSession) {
		t.Fatal(e)
	}
	l.users = recordUsers{err: xerr.ErrSession}
	if _, e = l.WalletLedger(ctx, r); !errors.Is(e, xerr.ErrSession) {
		t.Fatal(e)
	}
	l.users = recordUsers{}
	l.store = &fake{}
	if _, e = l.WalletLedger(ctx, r); e == nil {
		t.Fatal("store")
	}
}
