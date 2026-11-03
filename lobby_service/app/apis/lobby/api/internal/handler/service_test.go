package handler

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestInternalServiceAuthentication(t *testing.T) {
	for _, token := range []string{"", "Bearer wrong", "Bearer " + strings.Repeat("s", 32)} {
		hit := false
		h := ServiceOnly(strings.Repeat("s", 32), func(w http.ResponseWriter, _ *http.Request) { hit = true; w.WriteHeader(204) })
		r := httptest.NewRequest("POST", "/internal/game/settle", nil)
		r.Header.Set("Authorization", token)
		w := httptest.NewRecorder()
		h(w, r)
		if hit != (w.Code == 204) || hit != (token == "Bearer "+strings.Repeat("s", 32)) {
			t.Fatal(w.Code)
		}
	}
}
