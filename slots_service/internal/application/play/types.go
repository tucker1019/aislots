// Package play coordinates server-issued bet tickets and progressive spin settlement.
package play

import (
	runtime "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/domain/identity"
	"aislots/slots_service/internal/engine"
	"context"
	"encoding/json"
	"errors"
	"strconv"
	"strings"
	"time"
)

var (
	ErrInvalid      = errors.New("invalid request")
	ErrUnauthorized = errors.New("invalid or expired session")
	ErrConflict     = errors.New("game progress conflict")
	ErrExpired      = errors.New("unused bet ticket expired")
	ErrFunds        = errors.New("insufficient funds")
	ErrNotFound     = errors.New("bet not found")
)

type Session struct {
	Player    identity.Context
	GameID    string
	ExpiresAt time.Time
}
type TestProfile struct {
	Enabled        bool   `json:"enabled"`
	AppName        string `json:"appname"`
	AppKey         string `json:"appkey"`
	UID            string `json:"uid"`
	Country        string `json:"country"`
	Currency       string `json:"currency"`
	InitialBalance int64  `json:"initialBalance"`
}

func (p TestProfile) Player() identity.Context {
	return identity.Context{Subject: identity.Subject{AppName: p.AppName, AppKey: p.AppKey, UID: p.UID}, Country: p.Country, Currency: p.Currency}
}

type LoginRequest struct {
	LaunchTicket string `json:"launchTicket"`
	ExchangeID   string `json:"exchangeId"`
	Test         bool   `json:"test"`
	AppName      string `json:"appname"`
	AppKey       string `json:"appkey"`
	UID          string `json:"uid"`
	GameID       string `json:"gameId"`
}
type LoginResponse struct {
	AccessToken string           `json:"accessToken"`
	ExpiresAt   time.Time        `json:"expiresAt"`
	Player      identity.Context `json:"player"`
	Balance     int64            `json:"balance"`
}
type Ticket struct {
	ID                      string
	Player                  identity.Context
	GameID, Version, Status string
	Amount                  int64
	ExpiresAt               time.Time
	SpinIndex, StepIndex    int
	TotalWin                int64
}
type Cursor struct {
	SpinIndex int `json:"spinIndex"`
	StepIndex int `json:"stepIndex"`
}
type Frame struct {
	GameData         json.RawMessage `json:"gameData,omitempty"`
	BottomSymbols    []int           `json:"bottomSymbols,omitempty"`
	SpinWinAmount    int64           `json:"spinWinAmount,omitempty"`
	AwardedFreeSpins int             `json:"awardedFreeSpins,omitempty"`
	CascadeFactors   []string        `json:"cascadeFactors,omitempty"`
	CascadeIndex     int             `json:"cascadeIndex"`
	RequestID        string          `json:"requestId,omitempty"`
	NextRequestID    string          `json:"nextRequestId,omitempty"`
	PreviewRows      int             `json:"previewRows,omitempty"`
	BetID            string          `json:"betId"`
	SpinIndex        int             `json:"spinIndex"`
	StepIndex        int             `json:"stepIndex"`
	Mode             engine.Mode     `json:"mode"`
	Status           string          `json:"status"`
	NextAction       string          `json:"nextAction"`
	Next             *Cursor         `json:"next,omitempty"`
	Board            engine.Board    `json:"board"`
	Wins             []engine.Win    `json:"wins"`
	RemovedIDs       []int           `json:"removedIds"`
	TransformedIDs   []int           `json:"transformedIds"`
	WinAmount        int64           `json:"winAmount"`
	TotalWinAmount   int64           `json:"totalWinAmount"`
	BetAmount        int64           `json:"betAmount"`
	Balance          int64           `json:"balance"`
	FreeRemaining    int             `json:"freeRemaining"`
	TriggeredFree    bool            `json:"triggeredFree"`
}

// UnmarshalJSON accepts legacy database frames whose monetary fields were
// stored as decimal strings; marshaling continues to emit numeric int64s.
func (f *Frame) UnmarshalJSON(data []byte) error {
	type frameAlias Frame
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	for _, key := range []string{"spinWinAmount", "winAmount", "totalWinAmount", "betAmount", "balance"} {
		value, ok := raw[key]
		if !ok || len(value) == 0 || value[0] != '"' {
			continue
		}
		var text string
		if err := json.Unmarshal(value, &text); err != nil {
			return err
		}
		text = strings.TrimSpace(text)
		if text == "" {
			text = "0"
		}
		n, err := strconv.ParseInt(text, 10, 64)
		if err != nil {
			return err
		}
		raw[key], _ = json.Marshal(n)
	}
	var decoded frameAlias
	encoded, err := json.Marshal(raw)
	if err != nil {
		return err
	}
	if err = json.Unmarshal(encoded, &decoded); err != nil {
		return err
	}
	*f = Frame(decoded)
	return nil
}

type Prepared struct {
	BetID     string    `json:"betId"`
	BetAmount int64     `json:"betAmount"`
	ExpiresAt time.Time `json:"expiresAt"`
}
type Recovery struct {
	BetID    string    `json:"betId,omitempty"`
	Status   string    `json:"status"`
	Prepared *Prepared `json:"prepared,omitempty"`
	Frame    *Frame    `json:"frame,omitempty"`
	Balance  int64     `json:"balance"`
}
type StoredSpin struct {
	Result runtime.Result
}

// WithPlayer is a short local transaction. This store supports a TEST wallet only;
// no external platform network calls may be performed inside the transaction.
type Store interface {
	ReadBetRecords(context.Context, identity.Context, string, RecordQuery) ([]BetRecord, BetSummary, error)
	ReadBetReplay(context.Context, identity.Context, string, string, ReplayQuery) (BetRecord, []ReplayFrame, error)
	CreateSession(context.Context, string, Session, int64) (int64, error)
	Session(context.Context, string) (Session, error)
	WithPlayer(context.Context, identity.Context, func(Tx) error) error
}
type Tx interface {
	SpinToken(context.Context, string) (string, error)
	SpinReceipt(context.Context, string, string) (SpinReceipt, bool, error)
	LastSpinReceipt(context.Context, string, string) (SpinReceipt, bool, error)
	SaveSpinReceipt(context.Context, string, string, SpinReceipt, string) error
	Balance() int64
	FindOpen(context.Context, string) (Ticket, bool, error)
	Ticket(context.Context, string) (Ticket, error)
	SaveTicket(context.Context, Ticket) error
	State(context.Context, string) (runtime.State, error)
	SaveState(context.Context, string, runtime.State) error
	Spin(context.Context, string, int) (StoredSpin, bool, error)
	SaveSpin(context.Context, string, int, StoredSpin) error
	Frame(context.Context, string, int, int) (Frame, bool, error)
	SaveFrame(context.Context, Frame) error
	EnqueueOutbox(context.Context, string, string, string, any) error
	// Wallet posts one uniquely keyed operation and returns the new test balance.
	Wallet(context.Context, string, string, int64) (int64, error)
}

// SpinReceipt and the next request token commit alongside the round and wallet.
type SpinReceipt struct {
	Amount int64
	Frame  Frame
}
type Status struct {
	LastFrame *Frame `json:"lastFrame,omitempty"`
	RequestID string `json:"requestId"`
	Balance   int64  `json:"balance"`
	HasNext   bool   `json:"hasNext"`
	BetAmount int64  `json:"betAmount,omitempty"`
}
