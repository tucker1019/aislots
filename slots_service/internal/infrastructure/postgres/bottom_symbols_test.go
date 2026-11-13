package postgres_test

import (
	"context"
	"reflect"
	"testing"
)

func TestBottomSymbolsPersistAcrossStateReplayAndCascade(t *testing.T) {
	store, _ := database(t)
	s := service(t, store, &spinner{})
	session, _ := login(t, s)
	ctx := context.Background()
	state, err := s.Status(ctx, session, "AG1")
	if err != nil {
		t.Fatal(err)
	}
	frame, err := s.Spin(ctx, session, "AG1", state.RequestID, 100)
	if err != nil {
		t.Fatal(err)
	}
	original := append([]int(nil), frame.BottomSymbols...)
	if len(original) != 5 {
		t.Fatal("missing bottom")
	}
	for n := 0; n < 5; n++ {
		state, err = s.Status(ctx, session, "AG1")
		if err != nil || state.LastFrame == nil || !reflect.DeepEqual(state.LastFrame.BottomSymbols, original) {
			t.Fatal("state lost bottom", err)
		}
		if frame.NextAction == "complete" {
			break
		}
		frame, err = s.Spin(ctx, session, "AG1", frame.NextRequestID, 100)
		if err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(frame.BottomSymbols, original) {
			t.Fatal("cascade changed bottom")
		}
	}
	replay, err := s.BetReplay(ctx, session, "AG1", frame.BetID, 100, "")
	if err != nil || len(replay.Frames) == 0 {
		t.Fatal(err)
	}
	for _, f := range replay.Frames {
		if !reflect.DeepEqual(f.BottomSymbols, original) {
			t.Fatal("replay changed bottom")
		}
	}
	if frame.NextAction != "complete" {
		t.Fatal("first bet did not finish")
	}
	next, err := s.Spin(ctx, session, "AG1", frame.NextRequestID, 100)
	if err != nil {
		t.Fatal(err)
	}
	opening, err := s.BetReplay(ctx, session, "AG1", next.BetID, 1, "")
	if err != nil || !reflect.DeepEqual(opening.StartBoard, frame.Board) ||
		!reflect.DeepEqual(opening.StartBottomSymbols, original) || opening.StartPreviewRows != frame.PreviewRows {
		t.Fatal("replay opening differs from previous settled result", err)
	}
}
