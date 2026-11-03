package httpapi

import (
	"aislots/slots_service/internal/application/play"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRankReplayRequiresPlatformServiceSecret(t *testing.T) {
	for _, secret := range []string{"", strings.Repeat("s", 32)} {
		for _, token := range []string{"", strings.Repeat("x", 32)} {
			req := httptest.NewRequest("POST", "/internal/rank-replay", strings.NewReader(`{"uid":7,"gameId":"AG1","betId":"b"}`))
			req.Header.Set("Authorization", "Bearer "+token)
			if err := rankReplayHandler(nil, secret)(httptest.NewRecorder(), req); err != play.ErrUnauthorized {
				t.Fatal("unauthenticated request reached service", err)
			}
		}
	}
}
