package userservice

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository"
	"apps/app/apis/lobby/api/internal/repository/mocks"
	"apps/app/apis/lobby/api/internal/svc"
	pb "apps/pb/apis/lobby/api/v1"
	"apps/pkg/xerr"

	"go.uber.org/mock/gomock"
	"golang.org/x/crypto/bcrypt"
)

func setup(t *testing.T) (*Service, *mocks.MockUserStore) {
	t.Helper()
	m := mocks.NewMockUserStore(gomock.NewController(t))
	return NewUserLogic(svc.New(config.Config{SessionDays: 60}, &repository.Repository{Users: m})), m
}

func request() *pb.UserRequest {
	u := int64(7)
	s := strings.Repeat("a", 52)
	return &pb.UserRequest{Uid: &u, Sid: &s, Account: "alice", Password: "password123"}
}

func TestUserLogic_VisitorAndRegister(t *testing.T) {
	ctx := context.Background()
	l, m := setup(t)
	m.EXPECT().Create(ctx, "", "", gomock.Any(), gomock.Any()).Return(int64(7), nil)
	v, err := l.VisitorLogin(ctx, request())
	if err != nil || v.Uid != 7 || len(v.Sid) != 52 {
		t.Fatal(v, err)
	}
	m.EXPECT().Create(ctx, "alice", gomock.Any(), gomock.Any(), gomock.Any()).DoAndReturn(func(_ context.Context, _ string, hash, token string, expiry time.Time) (int64, error) {
		if bcrypt.CompareHashAndPassword([]byte(hash), []byte("password123")) != nil || len(token) != 64 || time.Until(expiry) < 59*24*time.Hour {
			t.Fatal("invalid credentials or expiry")
		}
		return 8, nil
	})
	v, err = l.UniqueCodeRegister(ctx, request())
	if err != nil || v.Uid != 8 {
		t.Fatal(v, err)
	}
	if _, err = l.UniqueCodeRegister(ctx, &pb.UserRequest{Account: "a", Password: "x"}); !errors.Is(err, xerr.ErrInvalid) {
		t.Fatal(err)
	}
	m.EXPECT().Create(ctx, "", "", gomock.Any(), gomock.Any()).Return(int64(0), xerr.ErrExists)
	if _, err = l.VisitorLogin(ctx, request()); !errors.Is(err, xerr.ErrExists) {
		t.Fatal(err)
	}
}

func TestUserLogic_Renewal(t *testing.T) {
	l, m := setup(t)
	ctx := context.Background()
	req := request()
	if _, err := l.SessionRenewal(ctx, &pb.UserRequest{}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	m.EXPECT().Renew(ctx, req.GetUid(), Hash(req.GetSid()), gomock.Any(), gomock.Any()).Return(nil)
	out, err := l.SessionRenewal(ctx, req)
	if err != nil || out.Sid != req.GetSid() {
		t.Fatal(out, err)
	}
	m.EXPECT().Renew(ctx, req.GetUid(), gomock.Any(), gomock.Any(), gomock.Any()).Return(xerr.ErrSession)
	if _, err = l.SessionRenewal(ctx, req); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
}

func TestUserLogic_Login(t *testing.T) {
	l, m := setup(t)
	ctx := context.Background()
	req := request()
	if _, err := l.UniqueCodeLogin(ctx, &pb.UserRequest{}); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	m.EXPECT().Check(ctx, int64(7), gomock.Any(), gomock.Any()).Return(xerr.ErrSession)
	if _, err := l.UniqueCodeLogin(ctx, req); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	m.EXPECT().Check(ctx, int64(7), gomock.Any(), gomock.Any()).Return(nil).Times(4)
	m.EXPECT().Credentials(ctx, "alice").Return(int64(0), "", xerr.ErrCredentials)
	if _, err := l.UniqueCodeLogin(ctx, req); !errors.Is(err, xerr.ErrCredentials) {
		t.Fatal(err)
	}
	hash, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.MinCost)
	m.EXPECT().Credentials(ctx, "alice").Return(int64(9), string(hash), nil).Times(3)
	bad := request()
	bad.Password = "incorrect"
	if _, err := l.UniqueCodeLogin(ctx, bad); !errors.Is(err, xerr.ErrCredentials) {
		t.Fatal(err)
	}
	m.EXPECT().NewSession(ctx, int64(9), gomock.Any(), gomock.Any()).Return(nil)
	out, err := l.UniqueCodeLogin(ctx, req)
	if err != nil || out.Uid != 9 || out.Sid == req.GetSid() {
		t.Fatal(out, err)
	}
	m.EXPECT().NewSession(ctx, int64(9), gomock.Any(), gomock.Any()).Return(xerr.ErrSession)
	if _, err = l.UniqueCodeLogin(ctx, req); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
}

func TestUserLogic_Bind(t *testing.T) {
	l, m := setup(t)
	ctx := context.Background()
	req := request()
	if _, err := l.UniqueCodeBind(ctx, &pb.UserRequest{}); !errors.Is(err, xerr.ErrInvalid) {
		t.Fatal(err)
	}
	noSession := request()
	noSession.Sid = nil
	if _, err := l.UniqueCodeBind(ctx, noSession); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	m.EXPECT().Bind(ctx, int64(7), Hash(req.GetSid()), "alice", gomock.Any(), gomock.Any(), gomock.Any()).Return(nil)
	out, err := l.UniqueCodeBind(ctx, req)
	if err != nil || out.Uid != 7 || out.Sid != req.GetSid() {
		t.Fatal(out, err)
	}
	m.EXPECT().Bind(ctx, int64(7), gomock.Any(), "alice", gomock.Any(), gomock.Any(), gomock.Any()).Return(xerr.ErrExists)
	if _, err = l.UniqueCodeBind(ctx, req); !errors.Is(err, xerr.ErrExists) {
		t.Fatal(err)
	}
}
