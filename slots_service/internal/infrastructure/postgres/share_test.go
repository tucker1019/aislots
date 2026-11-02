package postgres_test

import (
	"aislots/slots_service/internal/application/play"
	"aislots/slots_service/internal/transport/httpapi"
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestReplayShareIsPublicReadOnlyBoundAndPersistent(t *testing.T) {
	store, _ := database(t)
	s := service(t, store, &spinner{free: true})
	session, _ := login(t, s)
	ctx := context.Background()
	state, err := s.Status(ctx, session, "AG1")
	if err != nil {
		t.Fatal(err)
	}
	last, err := s.Spin(ctx, session, "AG1", state.RequestID, 100)
	if err != nil {
		t.Fatal(err)
	}
	id := last.BetID
	for last.NextAction != "complete" {
		last, err = s.Spin(ctx, session, "AG1", last.NextRequestID, 100)
		if err != nil {
			t.Fatal(err)
		}
	}
	before, err := s.Status(ctx, session, "AG1")
	if err != nil {
		t.Fatal(err)
	}
	other := session
	other.Player.Subject.UID = "not-owner"
	if _, err = s.CreateReplayShare(ctx, other, "AG1", id); !errors.Is(err, play.ErrNotFound) {
		t.Fatal("other user shared", err)
	}
	share, err := s.CreateReplayShare(ctx, session, "AG1", id)
	if err != nil {
		t.Fatal(err)
	}
	if len(share.ShareToken) != 52 {
		t.Fatal("weak/missing token")
	}
	restarted := service(t, store, &spinner{free: true})
	cursor := ""
	count := 0
	for {
		page, err := restarted.SharedReplay(ctx, "AG1", id, share.ShareToken, 2, cursor)
		if err != nil {
			t.Fatal(err)
		}
		for _, frame := range page.Frames {
			if frame.Balance != 0 || frame.RequestID != "" || frame.NextRequestID != "" || frame.Next != nil {
				t.Fatal("private state exposed")
			}
			count++
		}
		cursor = page.NextCursor
		if cursor == "" {
			break
		}
	}
	if count != 9 {
		t.Fatal("incomplete free replay", count)
	}
	for _, input := range []struct{ game, id, token string }{{"AG1", id, ""}, {"AG1", id, strings.Repeat("X", 52)}, {"other", id, share.ShareToken}, {"AG1", "other", share.ShareToken}} {
		if _, err = s.SharedReplay(ctx, input.game, input.id, input.token, 100, ""); !errors.Is(err, play.ErrNotFound) {
			t.Fatal("share scope bypass", err)
		}
	}
	if _, err = s.Authenticate(ctx, share.ShareToken); !errors.Is(err, play.ErrUnauthorized) {
		t.Fatal("share became login", err)
	}
	after, err := s.Status(ctx, session, "AG1")
	if err != nil || before.Balance != after.Balance || before.RequestID != after.RequestID {
		t.Fatal("share mutated wallet/nonce", err)
	}
	server := httptest.NewServer(httpapi.NewGameRouter(func() bool { return true }, s, nil, slog.New(slog.NewTextHandler(io.Discard, nil))))
	defer server.Close()
	response, err := http.Get(server.URL + "/api/v1/games/AG1/shared-replays/" + id + "?share=" + share.ShareToken)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		t.Fatal(response.StatusCode)
	}
	response2, err := http.Post(server.URL+"/api/v1/games/AG1/bet-records/"+id+"/share", "application/json", strings.NewReader("{}"))
	if err != nil {
		t.Fatal(err)
	}
	defer response2.Body.Close()
	if response2.StatusCode != 401 {
		t.Fatal("anonymous sharing allowed", response2.StatusCode)
	}
}
