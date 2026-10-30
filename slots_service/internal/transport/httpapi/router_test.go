package httpapi

import (
	"net/http/httptest"
	"testing"
)

func TestHealthAndUnregisteredBet(t *testing.T) {
	for _, ready := range []bool{false, true} {
		h := NewRouter(func() bool { return ready })
		for _, entry := range []struct {
			method, path string
			code         int
		}{{"GET", "/healthz", 200}, {"GET", "/readyz", map[bool]int{false: 503, true: 200}[ready]}, {"POST", "/v1/games/AG1/bet", 404}} {
			w := httptest.NewRecorder()
			h.ServeHTTP(w, httptest.NewRequest(entry.method, entry.path, nil))
			if w.Code != entry.code {
				t.Fatal(entry, w.Code)
			}
			if entry.code != 404 && w.Header().Get("Content-Type") != "application/json" {
				t.Fatal("missing JSON type")
			}
		}
	}
}
