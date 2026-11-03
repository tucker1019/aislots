package httpapi

import (
	"aislots/slots_service/internal/application/bet"
	"aislots/slots_service/internal/application/betlist"
	"aislots/slots_service/internal/application/play"
	"aislots/slots_service/internal/trace"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// NewGameRouter exposes our client API. The supplied play service is explicitly test-only.
func NewGameRouter(ready func() bool, service *play.Service, origins []string, logger *slog.Logger, replaySecrets ...string) http.Handler {
	mux := newHealthMux(ready)
	handle := func(pattern string, fn func(http.ResponseWriter, *http.Request) error) {
		mux.HandleFunc(pattern, func(w http.ResponseWriter, r *http.Request) {
			if err := fn(w, r); err != nil {
				writeError(w, r, err, logger)
			}
		})
	}
	secret := ""
	if len(replaySecrets) > 0 {
		secret = replaySecrets[0]
	}
	handle("POST /internal/rank-replay", rankReplayHandler(service, secret))

	auth := func(r *http.Request) (play.Session, error) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			return play.Session{}, play.ErrUnauthorized
		}
		return service.Authenticate(r.Context(), strings.TrimPrefix(header, "Bearer "))
	}
	handle("POST /api/v1/login", func(w http.ResponseWriter, r *http.Request) error {
		var input play.LoginRequest
		if err := decode(w, r, &input); err != nil {
			return err
		}
		out, err := service.Login(r.Context(), input)
		if err != nil {
			return err
		}
		success(w, out)
		return nil
	})
	handle("GET /api/v1/games/{gameId}/bets", func(w http.ResponseWriter, r *http.Request) error {
		session, err := auth(r)
		if err != nil {
			return err
		}
		policy, err := service.Bets(r.Context(), session, r.PathValue("gameId"))
		if err != nil {
			return err
		}
		amounts := []string{}
		for _, amount := range policy.Amounts {
			amounts = append(amounts, strconv.FormatInt(amount, 10))
		}
		success(w, map[string]any{"gameId": policy.GameID, "country": policy.Country, "currency": policy.Currency, "amountScale": policy.AmountScale, "lineCount": policy.LineCount, "betLevel": policy.BetLevel, "betOptions": amounts, "defaultBet": strconv.FormatInt(policy.Default, 10)})
		return nil
	})

	handle("POST /api/v1/games/{gameId}/spin", func(w http.ResponseWriter, r *http.Request) error {
		session, err := auth(r)
		if err != nil {
			return err
		}
		var input struct {
			RequestID string `json:"requestId"`
			Bet       string `json:"bet"`
			BetLevel  int    `json:"betLevel"`
		}
		if err = decode(w, r, &input); err != nil {
			return err
		}
		bet, err := strconv.ParseInt(input.Bet, 10, 64)
		if err != nil || bet < 1 || input.BetLevel < 1 {
			return play.ErrInvalid
		}
		policy, err := service.Bets(r.Context(), session, r.PathValue("gameId"))
		if err != nil || input.BetLevel > policy.BetLevel {
			return play.ErrInvalid
		}
		amount, err := strconv.ParseInt(input.Bet, 10, 64)
		if err != nil || amount > (int64(^uint64(0)>>1))/int64(policy.LineCount)/int64(input.BetLevel) {
			return play.ErrInvalid
		}
		amount *= int64(policy.LineCount) * int64(input.BetLevel)
		out, err := service.Spin(r.Context(), session, r.PathValue("gameId"), input.RequestID, amount)
		if err != nil {
			return err
		}
		success(w, out)
		return nil
	})
	handle("GET /api/v1/games/{gameId}/state", func(w http.ResponseWriter, r *http.Request) error {
		session, err := auth(r)
		if err != nil {
			return err
		}
		out, err := service.Status(r.Context(), session, r.PathValue("gameId"))
		if err != nil {
			return err
		}
		success(w, out)
		return nil
	})
	handle("GET /api/v1/games/{gameId}/bet-records", func(w http.ResponseWriter, r *http.Request) error {
		session, err := auth(r)
		if err != nil {
			return err
		}
		limit, err := historyLimit(r)
		if err != nil {
			return err
		}
		var filter play.HistoryFilter
		from, to := r.URL.Query().Get("from"), r.URL.Query().Get("to")
		if from != "" || to != "" {
			filter.From, err = time.Parse(time.RFC3339, from)
			if err != nil {
				return play.ErrInvalid
			}
			filter.To, err = time.Parse(time.RFC3339, to)
			if err != nil {
				return play.ErrInvalid
			}
		}
		out, err := service.FilteredBetRecords(r.Context(), session, r.PathValue("gameId"), limit, r.URL.Query().Get("cursor"), filter)
		if err != nil {
			return err
		}
		success(w, out)
		return nil
	})
	handle("GET /api/v1/games/{gameId}/bet-records/{betId}/replay", func(w http.ResponseWriter, r *http.Request) error {
		session, err := auth(r)
		if err != nil {
			return err
		}
		limit, err := historyLimit(r)
		if err != nil {
			return err
		}
		out, err := service.BetReplay(r.Context(), session, r.PathValue("gameId"), r.PathValue("betId"), limit, r.URL.Query().Get("cursor"))
		if err != nil {
			return err
		}
		success(w, out)
		return nil
	})
	handle("POST /api/v1/games/{gameId}/bet-records/{betId}/share", func(w http.ResponseWriter, r *http.Request) error {
		session, err := auth(r)
		if err != nil {
			return err
		}
		out, err := service.CreateReplayShare(r.Context(), session, r.PathValue("gameId"), r.PathValue("betId"))
		if err != nil {
			return err
		}
		w.Header().Set("Cache-Control", "no-store")
		success(w, out)
		return nil
	})
	handle("GET /api/v1/games/{gameId}/shared-replays/{betId}", func(w http.ResponseWriter, r *http.Request) error {
		limit, err := historyLimit(r)
		if err != nil {
			return err
		}
		out, err := service.SharedReplay(r.Context(), r.PathValue("gameId"), r.PathValue("betId"), r.URL.Query().Get("share"), limit, r.URL.Query().Get("cursor"))
		if err != nil {
			return err
		}
		w.Header().Set("Cache-Control", "no-store")
		success(w, out)
		return nil
	})
	allowed := map[string]bool{}
	for _, origin := range origins {
		allowed[origin] = true
	}
	return trace.Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		origin := r.Header.Get("Origin")
		if origin != "" {
			if !allowed[origin] {
				http.Error(w, "origin not allowed", http.StatusForbidden)
				return
			}
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Add("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		}
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		mux.ServeHTTP(w, r)
	}), logger)
}
func decode(w http.ResponseWriter, r *http.Request, target any) error {
	r.Body = http.MaxBytesReader(w, r.Body, 16*1024)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(target); err != nil {
		return play.ErrInvalid
	}
	if err := d.Decode(new(any)); err != io.EOF {
		return play.ErrInvalid
	}
	return nil
}
func success(w http.ResponseWriter, data any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"code": "OK", "data": data})
}
func writeError(w http.ResponseWriter, r *http.Request, err error, logger *slog.Logger) {
	code := "INTERNAL_ERROR"
	status := http.StatusInternalServerError
	message := "服务暂时不可用，请用原下注标识重试"
	switch {
	case errors.Is(err, play.ErrUnauthorized):
		code = "UNAUTHORIZED"
		status = 401
		message = "请重新登录"
	case errors.Is(err, play.ErrNotFound):
		code = "BET_NOT_FOUND"
		status = 404
		message = "下注不存在"
	case errors.Is(err, play.ErrExpired):
		code = "BET_EXPIRED"
		status = 409
		message = "下注凭据已过期"
	case errors.Is(err, play.ErrConflict):
		code = "STATE_CONFLICT"
		status = 409
		message = "游戏状态已变化，请恢复当前流程"
	case errors.Is(err, play.ErrFunds):
		code = "INSUFFICIENT_FUNDS"
		status = 409
		message = "测试余额不足"
	case errors.Is(err, play.ErrInvalid):
		code = "INVALID_REQUEST"
		status = 400
		message = "请求参数无效"
	case errors.Is(err, betlist.ErrNotAllowed):
		code = "BET_NOT_ALLOWED"
		status = 400
		message = "投注金额不在档位列表中"
	case errors.Is(err, betlist.ErrUnavailable), errors.Is(err, bet.ErrGameUnavailable):
		code = "GAME_NOT_AVAILABLE"
		status = 409
		message = "游戏或投注配置不可用"
	case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
		code = "REQUEST_INTERRUPTED"
		status = 503
	}
	if status >= 500 {
		trace.Logger(r.Context(), logger).ErrorContext(r.Context(), "game request failed", "path", r.URL.Path, "error", err)
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"code": code, "message": message})
}

// 省略limit时使用服务默认值；显式传0、负数或非整数均拒绝。
func historyLimit(r *http.Request) (int, error) {
	raw, ok := r.URL.Query()["limit"]
	if !ok {
		return 0, nil
	}
	if len(raw) != 1 {
		return 0, play.ErrInvalid
	}
	limit, err := strconv.Atoi(raw[0])
	if err != nil || limit < 1 {
		return 0, play.ErrInvalid
	}
	return limit, nil
}
