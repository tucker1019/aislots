package agentservice

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

	"go.uber.org/mock/gomock"
)

func TestAgentLogic(t *testing.T) {
	ctrl := gomock.NewController(t)
	store := mocks.NewMockAgentStore(ctrl)
	users := mocks.NewMockUserStore(ctrl)
	l := New(svc.New(config.Config{Agent: config.AgentConfig{Providers: map[string][]config.AgentTier{"AG": {{Threshold: 100, Rate: 30}}}}, Invite: config.InviteConfig{BaseURL: "https://example.com/"}}, &repository.Repository{Agent: store, Users: users}))
	uid := int64(1)
	sid := strings.Repeat("a", 52)
	ctx := context.Background()
	request := func() *pb.AgentRequest { return &pb.AgentRequest{Uid: &uid, Sid: &sid} }
	users.EXPECT().Check(gomock.Any(), gomock.Any(), gomock.Any(), gomock.Any()).Return(nil).AnyTimes()
	view := &model.AgentView{Items: []model.AgentRow{{UID: 2, Account: "x", Depth: 1, Commission: 30}}, InviteURL: "code", Providers: []string{"AG"}, Summary: model.AgentSummary{TeamCount: 1}}
	store.EXPECT().Query(gomock.Any(), gomock.Any(), gomock.Any()).Return(view, nil).AnyTimes()
	calls := []func(context.Context, *pb.AgentRequest) (*pb.AgentReply, error){l.AgentCenter, l.AgentTeam, l.AgentPerformance, l.AgentPerformanceDetails, l.AgentReport, l.AgentReportDetails, l.AgentRates, l.AgentRecords}
	for _, call := range calls {
		r := request()
		r.Kind = "bets"
		v, e := call(ctx, r)
		if e != nil || len(v.Items) != 1 || v.Summary.TeamCount != 1 {
			t.Fatal(v, e)
		}
	}
	for _, r := range []*pb.AgentRequest{{}, {Uid: &uid, Sid: &sid, Period: "bad"}, {Uid: &uid, Sid: &sid, Provider: "bad"}, {Uid: &uid, Sid: &sid, Scope: "bad"}, {Uid: &uid, Sid: &sid, Page: -1}, {Uid: &uid, Sid: &sid, Search: "\n"}} {
		if _, e := l.AgentTeam(ctx, r); e == nil {
			t.Fatal(r)
		}
	}
	if _, e := l.AgentReportDetails(ctx, request()); e == nil {
		t.Fatal("kind required")
	}
	r := request()
	if _, e := l.AgentClaim(ctx, r); e == nil {
		t.Fatal("id required")
	}
	r.RequestId = "claim"
	store.EXPECT().Claim(gomock.Any(), uid, "claim", gomock.Any()).Return(&model.LobbyAgentClaim{ClaimID: "claim", Amount: 5, Coins: 10, CreatedAt: time.Now()}, nil)
	if v, e := l.AgentClaim(ctx, r); e != nil || v.Amount != 5 {
		t.Fatal(v, e)
	}
	store.EXPECT().Claim(gomock.Any(), uid, "claim", gomock.Any()).Return(nil, errors.New("db"))
	if _, e := l.AgentClaim(ctx, r); e == nil {
		t.Fatal("claim error")
	}
	if _, e := l.AgentClaim(ctx, &pb.AgentRequest{}); e == nil {
		t.Fatal("auth")
	}
}
