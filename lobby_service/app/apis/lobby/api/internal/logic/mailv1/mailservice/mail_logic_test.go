package mailservice

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository"
	"apps/app/apis/lobby/api/internal/repository/mocks"
	"apps/app/apis/lobby/api/internal/repository/model"
	"apps/app/apis/lobby/api/internal/svc"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"

	"go.uber.org/mock/gomock"
)

func TestMailLogicListReadDeleteAndValidation(t *testing.T) {
	ctx := context.Background()
	store := mocks.NewMockMailStore(gomock.NewController(t))
	logic := New(svc.New(config.Config{}, &repository.Repository{Mail: store}))
	uid := int64(123)
	sid := strings.Repeat("x", 52)
	valid := &pb.MailListRequest{Uid: &uid, Sid: &sid, Limit: 10}
	if _, err := logic.MailList(ctx, &pb.MailListRequest{}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	if _, err := logic.MailRead(ctx, &pb.MailMutationRequest{}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	if _, err := logic.MailReadAll(ctx, &pb.MailListRequest{}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	if _, err := logic.MailDelete(ctx, &pb.MailMutationRequest{}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	when := time.Date(2026, 11, 24, 12, 0, 0, 0, time.UTC)
	store.EXPECT().List(ctx, uid, gomock.Any(), gomock.Any(), "", 10).Return([]model.PlayerMail{{ID: 9, RewardType: "rebate_daily", NoticeType: "reminder_12", ReminderHours: 12, BusinessDate: "2026-11-23", Deadline: when.Add(time.Hour), ActionPath: "/earn", SentAt: when, Unread: true}}, "8", true, nil)
	out, err := logic.MailList(ctx, valid)
	if err != nil || len(out.Items) != 1 || out.NextCursor != "8" || !out.HasMore || out.Items[0].NoticeType != "reminder" || out.Items[0].ReminderHours != 12 || !out.Items[0].Unread {
		t.Fatal(out, err)
	}
	store.EXPECT().MarkRead(ctx, uid, gomock.Any(), gomock.Any(), int64(9)).Return(nil)
	read, err := logic.MailRead(ctx, &pb.MailMutationRequest{Uid: &uid, Sid: &sid, MailId: 9})
	if err != nil || !read.Success {
		t.Fatal(read, err)
	}
	store.EXPECT().ReadAll(ctx, uid, gomock.Any(), gomock.Any()).Return(xerr.ErrSession)
	if _, err = logic.MailReadAll(ctx, &pb.MailListRequest{Uid: &uid, Sid: &sid}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	store.EXPECT().Delete(ctx, uid, gomock.Any(), gomock.Any(), int64(9)).Return(nil)
	deleted, err := logic.MailDelete(ctx, &pb.MailMutationRequest{Uid: &uid, Sid: &sid, MailId: 9})
	if err != nil || !deleted.Success {
		t.Fatal(deleted, err)
	}
}
