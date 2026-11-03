package gameservice

import (
	"apps/app/apis/lobby/api/internal/repository/model"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

type reportFake struct {
	fake
	err error
}

func (f *reportFake) PersonalReport(context.Context, int64, string, time.Time) (*model.PersonalReportView, error) {
	return &model.PersonalReportView{Amounts: map[string]int64{"recharge": 10000, "netProfit": -30}, From: time.Now(), To: time.Now().Add(time.Hour), Timezone: "Asia/Jakarta"}, f.err
}
func TestPersonalReportAuthorizationAndFields(t *testing.T) {
	uid := int64(7)
	sid := strings.Repeat("s", 52)
	l := &Logic{users: recordUsers{}, store: &reportFake{}}
	r := &pb.PersonalReportRequest{Uid: &uid, Sid: &sid, Period: "today"}
	ctx := context.Background()
	for _, period := range []string{"today", "yesterday", "this_week", "last_week"} {
		r.Period = period
		v, e := l.PersonalReport(ctx, r)
		if e != nil || len(v.Items) != 17 || v.Items[0].Amount != 10000 || v.Items[1].Supported || v.Items[len(v.Items)-1].Amount != -30 {
			t.Fatal(v, e)
		}
	}
	r.Period = "invalid"
	if _, e := l.PersonalReport(ctx, r); e == nil {
		t.Fatal("invalid period accepted")
	}
	r.Period = "today"
	l.users = recordUsers{err: xerr.ErrSession}
	if _, e := l.PersonalReport(ctx, r); e == nil {
		t.Fatal("unauthorized")
	}
	l.users = recordUsers{}
	l.store = &reportFake{err: errors.New("database")}
	if _, e := l.PersonalReport(ctx, r); e == nil {
		t.Fatal("store error ignored")
	}
	l.store = &fake{}
	if _, e := l.PersonalReport(ctx, r); e == nil {
		t.Fatal("missing store")
	}
	r.Uid = nil
	if _, e := l.PersonalReport(ctx, r); e == nil {
		t.Fatal("missing identity")
	}
}
