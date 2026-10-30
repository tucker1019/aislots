package bet

import (
	"aislots/slots_service/internal/domain/identity"
	"aislots/slots_service/internal/engine"
	"context"
	"errors"
)

var (
	ErrInvalidRequest  = errors.New("invalid bet request")
	ErrRequestConflict = errors.New("request ID already used for a different bet")
	ErrGameUnavailable = errors.New("game/version unavailable")
	ErrProcessing      = errors.New("bet settlement processing; retry the same request")
	ErrDebitRejected   = errors.New("platform rejected debit")
	ErrSpinFailed      = errors.New("spin failed; debit refunded or not charged")
)

type Request struct {
	Player            identity.Context
	RequestID, GameID string
	BetMinorUnits     int64
}
type Status string

const (
	DebitPending  Status = "debit_pending"
	Drawing       Status = "drawing"
	CreditPending Status = "credit_pending"
	RefundPending Status = "refund_pending"
	Settled       Status = "settled"
	Failed        Status = "failed"
)

func (s Status) Terminal() bool { return s == Settled || s == Failed }

type Response struct {
	RoundID                   string             `json:"roundId"`
	RequestID                 string             `json:"requestId"`
	Status                    Status             `json:"status"`
	PlatformBalanceMinorUnits *int64             `json:"platformBalanceMinorUnits,omitempty"`
	Result                    *engine.SpinResult `json:"result,omitempty"`
}

// StateKey isolates game state across currency and country as well as the complete platform identity.
type StateKey struct{ GameID, Country, Currency string }

func (r Request) StateKey() StateKey { return StateKey{r.GameID, r.Player.Country, r.Player.Currency} }

type Order struct {
	RuleType                                                     string
	Request                                                      Request
	RoundID                                                      string
	Status                                                       Status
	Before                                                       engine.State
	Result                                                       *engine.SpinResult
	DebitTransactionID, CreditTransactionID, RefundTransactionID string
	PlatformBalanceMinorUnits                                    *int64
	FailureCode, LastError                                       string
}

// Store serializes the complete subject across games. WithSubject is an exclusive lock/lease,
// NOT one SQL transaction: SaveOrder commits each intent before calling the platform.
// Durable adapters need cross-instance ownership/fencing and unique(subject, request_id).
// Do not automatically retry fn. Every SaveOrder is its own atomic, durable commit.
type Store interface {
	WithSubject(context.Context, identity.Subject, func(LockedStore) error) error
}
type LockedStore interface {
	FindOrder(context.Context, string) (Order, bool, error)
	FindPending(context.Context) (Order, bool, error)
	LoadState(context.Context, StateKey) (engine.State, error)
	// commitState atomically persists Order.Result.NextState along with the settled order.
	SaveOrder(ctx context.Context, order Order, commitState bool) error
}
type Spinner interface {
	// Type identifies the rules used for generating and validating the outcome.
	Type() string
	Version() string
	Spin(context.Context, engine.SpinRequest) (engine.SpinResult, error)
}
type Games interface {
	Resolve(gameID, version string) (Spinner, error)
}

// Bets validates a paid stake from an explicit game/country/currency/application policy.
// Free spins reuse the locked original stake and must not re-check a changed paid bet list.
type Bets interface {
	Allowed(context.Context, identity.Context, string, int64) error
}
