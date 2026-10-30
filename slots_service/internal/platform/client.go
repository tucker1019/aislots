// Package platform defines outbound platform integration contracts. No local wallet is maintained.
package platform

import (
	"aislots/slots_service/internal/domain/identity"
	"context"
	"errors"
)

var ErrUnavailable = errors.New("platform adapter unavailable")

type LoginRequest struct {
	Subject    identity.Subject
	Credential string
}
type VerifiedUser struct{ Context identity.Context }
type Action string

const (
	Debit  Action = "debit"
	Credit Action = "credit"
	Refund Action = "refund"
)

type Status string

const (
	Confirmed Status = "confirmed"
	Rejected  Status = "rejected"
	Unknown   Status = "unknown"
	NotFound  Status = "not_found"
)

type Transfer struct {
	ID                        string // Stable provider transaction ID, reused on every retry.
	Subject                   identity.Subject
	GameID, RoundID, Currency string
	Action                    Action
	AmountMinorUnits          int64
	RelatedID                 string // Refund references the original debit ID.
}
type Receipt struct {
	Status        Status
	TransactionID string
	// Platform-reported observation only; never used as a local wallet balance.
	BalanceMinorUnits *int64
}

// Client adapters MUST provide idempotency for Transfer.ID and validate echoed transaction data.
// Query must find a previous call even if its HTTP response was lost. NotFound means it is safe
// to submit the SAME transfer ID. Pending/ambiguous/unsupported lookups must return Unknown.
// Errors must never be interpreted as a confirmed rejection. Refunds must be idempotent too.
type Client interface {
	VerifyUser(context.Context, LoginRequest) (VerifiedUser, error)
	Transfer(context.Context, Transfer) (Receipt, error)
	QueryTransfer(context.Context, Transfer) (Receipt, error)
}
type Resolver interface {
	Resolve(appName, appKey string) (Client, error)
}
