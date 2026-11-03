package gameservice

import (
	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository"
	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

type recordUsers struct {
	repository.UserStore
	err error
}

func (u recordUsers) Check(context.Context, int64, string, time.Time) error { return u.err }

type recordFake struct {
	fake
	err  error
	rows []model.GameRecordRow
}

func (f *recordFake) Records(context.Context, int64, time.Time, time.Time, int, []string) ([]model.GameRecordRow, model.GameRecordSummary, error) {
	return f.rows, model.GameRecordSummary{Count: 30, BetAmount: 3000, Profit: -50}, f.err
}
func TestRecordsValidationAndServerMetadata(t *testing.T) {
	uid := int64(7)
	sid := strings.Repeat("s", 52)
	ctx := context.Background()
	f := &recordFake{}
	for i := 0; i < 21; i++ {
		f.rows = append(f.rows, model.GameRecordRow{GameID: "AG1", BetID: "bet", CreatedAt: time.Now(), BetAmount: 100})
	}
	l := &Logic{users: recordUsers{}, store: f, config: config.GameConfig{Currency: "IDR", Games: map[string]config.GameEntry{"AG1": {Provider: "AG", Name: "麻将胡了"}}}}
	req := &pb.GameRecordsRequest{Uid: &uid, Sid: &sid, From: "2026-11-01T00:00:00Z", To: "2026-11-02T00:00:00Z", Page: 1}
	out, e := l.GameRecords(ctx, req)
	if e != nil || len(out.Items) != 20 || !out.HasMore || out.Items[0].Provider != "AG" || out.BetAmount != 3000 {
		t.Fatal(out, e)
	}
	req.Provider = "AG"
	if _, e = l.GameRecords(ctx, req); e != nil {
		t.Fatal(e)
	}
	req.Provider = "unknown"
	if _, e = l.GameRecords(ctx, req); !errors.Is(e, xerr.ErrInvalid) {
		t.Fatal(e)
	}
	req.Provider = ""

	if _, e = l.GameRecords(ctx, &pb.GameRecordsRequest{}); !errors.Is(e, xerr.ErrSession) {
		t.Fatal(e)
	}
	for _, r := range []*pb.GameRecordsRequest{{Uid: &uid, Sid: &sid, From: "bad"}, {Uid: &uid, Sid: &sid, From: req.From, To: "bad"}, {Uid: &uid, Sid: &sid, From: req.From, To: req.To, Page: 0}, {Uid: &uid, Sid: &sid, From: req.To, To: req.From, Page: 1}} {
		if _, e = l.GameRecords(ctx, r); !errors.Is(e, xerr.ErrInvalid) {
			t.Fatal(e)
		}
	}
	l.users = recordUsers{err: xerr.ErrSession}
	if _, e = l.GameRecords(ctx, req); !errors.Is(e, xerr.ErrSession) {
		t.Fatal(e)
	}
	l.users = recordUsers{}
	f.err = errors.New("db")
	if _, e = l.GameRecords(ctx, req); e == nil {
		t.Fatal("database error hidden")
	}
	f.err = nil
	l.store = &fake{}
	if _, e = l.GameRecords(ctx, req); e == nil {
		t.Fatal("missing store accepted")
	}
}
