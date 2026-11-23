package mailservice

import (
	"context"
	"strconv"
	"strings"
	"time"

	userlogic "apps/app/apis/lobby/api/internal/logic/userv1/userservice"
	"apps/app/apis/lobby/api/internal/repository"
	"apps/app/apis/lobby/api/internal/svc"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"
)

type Logic struct{ store repository.MailStore }

func New(s *svc.ServiceContext) *Logic { return &Logic{store: s.Repo.Mail} }

func (l *Logic) MailList(ctx context.Context, r *pb.MailListRequest) (*pb.MailListReply, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	limit := int(r.GetLimit())
	if limit == 0 {
		limit = 50
	}
	items, cursor, hasMore, err := l.store.List(ctx, r.GetUid(), userlogic.Hash(r.GetSid()), time.Now().UTC(), r.Cursor, limit)
	if err != nil {
		return nil, xerr.Public(err)
	}
	out := &pb.MailListReply{Items: make([]*pb.MailMessage, 0, len(items)), NextCursor: cursor, HasMore: hasMore}
	for _, item := range items {
		noticeType := item.NoticeType
		reminderHours := item.ReminderHours
		if strings.HasPrefix(noticeType, "reminder_") {
			parsed, parseErr := strconv.ParseInt(strings.TrimPrefix(noticeType, "reminder_"), 10, 32)
			if parseErr == nil {
				noticeType = "reminder"
				reminderHours = int32(parsed)
			}
		}
		out.Items = append(out.Items, &pb.MailMessage{
			MailId:        item.ID,
			RewardType:    item.RewardType,
			NoticeType:    noticeType,
			ReminderHours: reminderHours,
			BusinessDate:  item.BusinessDate,
			Deadline:      item.Deadline.UTC().Format(time.RFC3339),
			ActionPath:    item.ActionPath,
			SentAt:        item.SentAt.UTC().Format(time.RFC3339),
			Unread:        item.Unread,
		})
	}
	return out, nil
}

func (l *Logic) MailRead(ctx context.Context, r *pb.MailMutationRequest) (*pb.MailMutationReply, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 || r.MailId <= 0 {
		return nil, xerr.ErrSession
	}
	if err := l.store.MarkRead(ctx, r.GetUid(), userlogic.Hash(r.GetSid()), time.Now().UTC(), r.MailId); err != nil {
		return nil, xerr.Public(err)
	}
	return &pb.MailMutationReply{Success: true}, nil
}

func (l *Logic) MailReadAll(ctx context.Context, r *pb.MailListRequest) (*pb.MailMutationReply, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 {
		return nil, xerr.ErrSession
	}
	if err := l.store.ReadAll(ctx, r.GetUid(), userlogic.Hash(r.GetSid()), time.Now().UTC()); err != nil {
		return nil, xerr.Public(err)
	}
	return &pb.MailMutationReply{Success: true}, nil
}

func (l *Logic) MailDelete(ctx context.Context, r *pb.MailMutationRequest) (*pb.MailMutationReply, error) {
	if r.GetUid() <= 0 || len(r.GetSid()) != 52 || r.MailId <= 0 {
		return nil, xerr.ErrSession
	}
	if err := l.store.Delete(ctx, r.GetUid(), userlogic.Hash(r.GetSid()), time.Now().UTC(), r.MailId); err != nil {
		return nil, xerr.Public(err)
	}
	return &pb.MailMutationReply{Success: true}, nil
}
