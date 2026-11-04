package httpapi

import (
	"aislots/slots_service/internal/application/play"
	"crypto/subtle"
	"net/http"
)

func autoRoundHandler(s *play.Service, secret string) func(http.ResponseWriter, *http.Request) error {
	return func(w http.ResponseWriter, r *http.Request) error {
		if len(secret) < 32 || subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+secret)) != 1 {
			return play.ErrUnauthorized
		}
		var in play.AutoRoundRequest
		if e := decode(w, r, &in); e != nil {
			return e
		}
		out, e := s.AutoRound(r.Context(), in)
		if e != nil {
			return e
		}
		w.Header().Set("Cache-Control", "no-store")
		success(w, out)
		return nil
	}
}
