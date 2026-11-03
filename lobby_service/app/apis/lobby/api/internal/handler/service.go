package handler

import (
	"crypto/subtle"
	"net/http"

	"apps/pkg/xerr"
)

// Internal game calls never accept browser uid/sid as service authorization.
func ServiceOnly(secret string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if len(secret) < 32 || subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte("Bearer "+secret)) != 1 {
			fail(w, r, xerr.ErrSession)
			return
		}
		next(w, r)
	}
}
