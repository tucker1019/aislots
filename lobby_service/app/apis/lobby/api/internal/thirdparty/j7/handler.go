package j7

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/app/apis/lobby/api/internal/repository/model"
	"apps/pkg/xlog"
)

const ProviderName = "j7"

type Handler struct {
	Config Config
	Games  map[string]config.GameEntry
	Store  *model.ThirdPartyModel
}

func (h *Handler) Register(mux *http.ServeMux, prefix string) {
	p := strings.TrimRight(prefix, "/")
	mux.HandleFunc("POST "+p+"/Cash/Get", h.CashGet)
	mux.HandleFunc("POST "+p+"/Cash/TransferInOut", h.CashTransferInOut)
	mux.HandleFunc("POST "+p+"/Cash/Rollback", h.CashRollback)
}

func (h *Handler) authenticate(appID, appSecret string) bool {
	if !h.Config.Configured() {
		return false
	}
	idMatch := subtle.ConstantTimeCompare([]byte(appID), []byte(h.Config.AppID)) == 1
	secretMatch := subtle.ConstantTimeCompare([]byte(appSecret), []byte(h.Config.AppSecret)) == 1
	return idMatch && secretMatch
}

func (h *Handler) resolveGameID(externalGameID string) string {
	ext := strings.TrimSpace(externalGameID)
	for id, g := range h.Games {
		if g.IsThirdPartyJ7() && g.ExternalGameID == ext {
			return id
		}
	}
	if ext == "" {
		return "J7_UNKNOWN"
	}
	return "J7_" + ext
}

func writeJSON(w http.ResponseWriter, code int, errMsg string, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"code":  code,
		"error": errMsg,
		"data":  data,
	})
}

func coinsToFloat(coins int64) float64 {
	return math.Round(float64(coins)) / 100.0
}

func amountToMinor(amount float64) (int64, bool) {
	if math.IsNaN(amount) || math.IsInf(amount, 0) || amount == 0 {
		return 0, false
	}
	scaled := math.Round(amount * 100)
	if scaled == 0 || scaled > float64(math.MaxInt64/2) || scaled < float64(math.MinInt64/2) {
		return 0, false
	}
	return int64(scaled), true
}

func decodeBody(w http.ResponseWriter, r *http.Request, dst any) bool {
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 64*1024))
	if err != nil {
		writeJSON(w, 1, "invalid request", nil)
		return false
	}
	if err := json.Unmarshal(body, dst); err != nil {
		writeJSON(w, 1, "invalid request", nil)
		return false
	}
	return true
}

type cashGetRequest struct {
	UserID    string `json:"UserID"`
	AppID     string `json:"AppID"`
	AppSecret string `json:"AppSecret"`
}

func (h *Handler) CashGet(w http.ResponseWriter, r *http.Request) {
	var req cashGetRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if !h.authenticate(req.AppID, req.AppSecret) {
		xlog.Info(r.Context(), "j7 cash get auth failed", "appId", req.AppID)
		writeJSON(w, 1, "auth failed", nil)
		return
	}
	uid, err := strconv.ParseInt(strings.TrimSpace(req.UserID), 10, 64)
	if err != nil || uid <= 0 {
		writeJSON(w, 1, "user not found", nil)
		return
	}
	coins, err := h.Store.Balance(r.Context(), uid)
	if err != nil {
		if errors.Is(err, model.ErrThirdPartyUserNotFound) {
			writeJSON(w, 1, "user not found", nil)
			return
		}
		xlog.Error(r.Context(), "j7 cash get failed", "uid", uid, "error", err)
		writeJSON(w, 1, "internal error", nil)
		return
	}
	writeJSON(w, 0, "", map[string]any{
		"Balance":    coinsToFloat(coins),
		"BalanceMax": 0,
	})
}

type transferRequest struct {
	UserID        string  `json:"UserID"`
	AppID         string  `json:"AppID"`
	AppSecret     string  `json:"AppSecret"`
	TransactionID string  `json:"TransactionID"`
	Amount        float64 `json:"Amount"`
	GameID        string  `json:"GameID"`
	Reason        string  `json:"Reason"`
	RoundID       string  `json:"RoundID"`
	BetID         string  `json:"BetID"`
}

func (h *Handler) CashTransferInOut(w http.ResponseWriter, r *http.Request) {
	var req transferRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if !h.authenticate(req.AppID, req.AppSecret) {
		xlog.Info(r.Context(), "j7 transfer auth failed", "appId", req.AppID)
		writeJSON(w, 1, "auth failed", nil)
		return
	}
	if strings.TrimSpace(req.TransactionID) == "" {
		writeJSON(w, 1, "TransactionID is required", nil)
		return
	}
	uid, err := strconv.ParseInt(strings.TrimSpace(req.UserID), 10, 64)
	if err != nil || uid <= 0 {
		writeJSON(w, 1, "user not found", nil)
		return
	}
	amountMinor, ok := amountToMinor(req.Amount)
	if !ok {
		writeJSON(w, 1, "invalid amount", nil)
		return
	}
	gameID := h.resolveGameID(req.GameID)
	coins, err := h.Store.TransferInOut(r.Context(), model.ThirdPartyTransferInput{
		Provider:       ProviderName,
		TransactionID:  strings.TrimSpace(req.TransactionID),
		RoundID:        strings.TrimSpace(req.RoundID),
		BetID:          strings.TrimSpace(req.BetID),
		UID:            uid,
		GameID:         gameID,
		ExternalGameID: strings.TrimSpace(req.GameID),
		Reason:         strings.TrimSpace(req.Reason),
		AmountMinor:    amountMinor,
	}, time.Now().UTC())
	if err != nil {
		switch {
		case errors.Is(err, model.ErrThirdPartyUserNotFound):
			writeJSON(w, 1, "user not found", nil)
		case errors.Is(err, model.ErrThirdPartyInsufficientFunds):
			writeJSON(w, 1, "insufficient balance", nil)
		case errors.Is(err, model.ErrThirdPartyInvalidAmount):
			writeJSON(w, 1, "invalid amount", nil)
		case errors.Is(err, model.ErrThirdPartyConflict):
			writeJSON(w, 1, "transaction conflict", nil)
		default:
			xlog.Error(r.Context(), "j7 transfer failed", "uid", uid, "tx", req.TransactionID, "reason", req.Reason, "error", err)
			writeJSON(w, 1, "internal error", nil)
		}
		return
	}
	xlog.Info(r.Context(), "j7 transfer settled", "uid", uid, "tx", req.TransactionID, "roundId", req.RoundID, "gameId", gameID, "reason", req.Reason, "amountMinor", amountMinor, "balance", coins)
	writeJSON(w, 0, "", map[string]any{
		"Balance": coinsToFloat(coins),
		"Profit":  "0",
	})
}

type rollbackRequest struct {
	AppID         string `json:"AppID"`
	AppSecret     string `json:"AppSecret"`
	UserID        string `json:"UserID"`
	TransactionID string `json:"TransactionID"`
	GameID        string `json:"GameID"`
	RoundID       string `json:"RoundID"`
}

func (h *Handler) CashRollback(w http.ResponseWriter, r *http.Request) {
	var req rollbackRequest
	if !decodeBody(w, r, &req) {
		return
	}
	if !h.authenticate(req.AppID, req.AppSecret) {
		xlog.Info(r.Context(), "j7 rollback auth failed", "appId", req.AppID)
		writeJSON(w, 1, "auth failed", nil)
		return
	}
	if strings.TrimSpace(req.TransactionID) == "" {
		writeJSON(w, 1, "TransactionID is required", nil)
		return
	}
	uid, err := strconv.ParseInt(strings.TrimSpace(req.UserID), 10, 64)
	if err != nil || uid <= 0 {
		writeJSON(w, 1, "user not found", nil)
		return
	}
	coins, err := h.Store.Rollback(r.Context(), ProviderName, strings.TrimSpace(req.TransactionID), uid, time.Now().UTC())
	if err != nil {
		switch {
		case errors.Is(err, model.ErrThirdPartyUserNotFound):
			writeJSON(w, 1, "user not found", nil)
		case errors.Is(err, model.ErrThirdPartyConflict):
			writeJSON(w, 1, "transaction conflict", nil)
		default:
			xlog.Error(r.Context(), "j7 rollback failed", "uid", uid, "tx", req.TransactionID, "error", err)
			writeJSON(w, 1, "internal error", nil)
		}
		return
	}
	xlog.Info(r.Context(), "j7 rollback settled", "uid", uid, "tx", req.TransactionID, "roundId", req.RoundID, "balance", coins)
	writeJSON(w, 0, "", map[string]any{
		"Balance": coinsToFloat(coins),
		"Profit":  "0",
	})
}
