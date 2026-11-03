package httpapi

import (
	"aislots/slots_service/internal/application/play"
	"crypto/subtle"
	"net/http"
	"strconv"
	"strings"
)

func rankReplayHandler(service *play.Service, secret string) func(http.ResponseWriter, *http.Request) error {
	return func(w http.ResponseWriter, r *http.Request) error {
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if !strings.HasPrefix(r.Header.Get("Authorization"), "Bearer ") || len(secret) < 32 || subtle.ConstantTimeCompare([]byte(token), []byte(secret)) != 1 {
			return play.ErrUnauthorized
		}
		var in struct {
			UID    int64  `json:"uid"`
			GameID string `json:"gameId"`
			BetID  string `json:"betId"`
		}
		if err := decode(w, r, &in); err != nil {
			return err
		}
		if in.UID <= 0 || in.GameID == "" || in.BetID == "" || len(in.BetID) > 128 {
			return play.ErrInvalid
		}
		out, err := service.RankReplay(r.Context(), in.GameID, in.BetID, strconv.FormatInt(in.UID, 10))
		if err != nil {
			return err
		}
		w.Header().Set("Cache-Control", "no-store")
		success(w, out)
		return nil
	}
}
