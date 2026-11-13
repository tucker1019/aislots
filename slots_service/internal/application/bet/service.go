// Package bet coordinates platform debit, game calculation and platform credit using persistent orders.
package bet

import (
	runtime "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/domain/identity"
	"aislots/slots_service/internal/platform"
	"context"
	"crypto/rand"
	"fmt"
	"strings"
)

type Service struct {
	games     Games
	store     Store
	platforms platform.Resolver
	bets      Bets
}

func New(g Games, s Store, p platform.Resolver, b Bets) (*Service, error) {
	if g == nil || s == nil || p == nil || b == nil {
		return nil, fmt.Errorf("games, order store, platform resolver and bet policies required")
	}
	return &Service{g, s, p, b}, nil
}
func (s *Service) Bet(ctx context.Context, req Request) (Response, error) {
	if !req.Player.Valid() || strings.TrimSpace(req.RequestID) == "" || len(req.RequestID) > 128 || strings.TrimSpace(req.GameID) == "" || len(req.GameID) > 128 || req.BetMinorUnits < 0 {
		return Response{}, ErrInvalidRequest
	}
	var response Response
	err := s.store.WithSubject(ctx, req.Player.Subject, func(store LockedStore) error {
		order, found, err := store.FindOrder(ctx, req.RequestID)
		if err != nil {
			return err
		}
		if found {
			if order.Request != req {
				return ErrRequestConflict
			}
			response = order.response()
			if order.Status.Terminal() {
				return order.failure()
			}
		}
		if !found {
			pending, ok, err := store.FindPending(ctx)
			if err != nil {
				return err
			}
			if ok {
				return fmt.Errorf("%w: unresolved round %s", ErrProcessing, pending.RoundID)
			}
			state, err := store.LoadState(ctx, req.StateKey())
			if err != nil {
				return err
			}
			if !state.Pending {
				if req.BetMinorUnits <= 0 {
					return ErrInvalidRequest
				}
				if err = s.bets.Allowed(ctx, req.Player, req.GameID, req.BetMinorUnits); err != nil {
					return err
				}
			} else if req.BetMinorUnits != 0 {
				return ErrInvalidRequest
			}
			game, err := s.games.Resolve(req.GameID, state.Version)
			if err != nil {
				return err
			}
			if _, err = s.platforms.Resolve(req.Player.Subject.AppName, req.Player.Subject.AppKey); err != nil {
				return err
			}
			state.Version = game.Version()
			status := DebitPending
			if req.BetMinorUnits == 0 {
				status = Drawing
			}
			order = Order{RuleType: game.Type(), Request: req, RoundID: rand.Text(), Status: status, Before: state}
			if err = store.SaveOrder(ctx, order, false); err != nil {
				return err
			}
			response = order.response()
		}
		client, err := s.platforms.Resolve(req.Player.Subject.AppName, req.Player.Subject.AppKey)
		if err != nil {
			return fmt.Errorf("%w: %v", ErrProcessing, err)
		}
		for !order.Status.Terminal() {
			if err = ctx.Err(); err != nil {
				return fmt.Errorf("%w: %v", ErrProcessing, err)
			}
			switch order.Status {
			case DebitPending, CreditPending, RefundPending:

				if order.Status == CreditPending {
					if order.Result == nil {
						return fmt.Errorf("missing stored settlement")
					}
					module, err := s.games.Resolve(req.GameID, order.Before.Version)
					if err != nil {
						return err
					}
					if err = order.Result.Validate(); err != nil {
						return err
					}
					if order.Result.GameID != req.GameID || order.Result.Version != module.Version() || order.Result.RuleType != order.RuleType || order.Result.ChargeMinorUnits != req.BetMinorUnits {
						return fmt.Errorf("stored settlement identity mismatch")
					}
					if err = module.ValidateStoredResult(*order.Result); err != nil {
						return err
					}
				}
				transfer := order.transfer()
				receipt, err := client.QueryTransfer(ctx, transfer)
				if err == nil && receipt.Status == platform.NotFound {
					receipt, err = client.Transfer(ctx, transfer)
				}
				if err != nil || receipt.Status != platform.Confirmed && receipt.Status != platform.Rejected {
					order.LastError = "platform transaction unresolved"
					if err != nil {
						order.LastError = err.Error()
					}
					if saveErr := store.SaveOrder(ctx, order, false); saveErr != nil {
						return fmt.Errorf("%w: %v", ErrProcessing, saveErr)
					}
					response = order.response()
					return ErrProcessing
				}
				if receipt.Status == platform.Rejected {
					if order.Status != DebitPending {
						order.LastError = "platform rejected settlement; reconciliation required"
						if err = store.SaveOrder(ctx, order, false); err != nil {
							return fmt.Errorf("%w: %v", ErrProcessing, err)
						}
						response = order.response()
						return ErrProcessing
					}
					order.Status = Failed
					order.FailureCode = "debit_rejected"
				} else {
					order.LastError = ""
					if receipt.BalanceMinorUnits != nil {
						v := *receipt.BalanceMinorUnits
						order.PlatformBalanceMinorUnits = &v
					}
					switch order.Status {
					case DebitPending:
						order.DebitTransactionID = receipt.TransactionID
						order.Status = Drawing
					case CreditPending:
						order.CreditTransactionID = receipt.TransactionID
						order.Status = Settled
					case RefundPending:
						order.RefundTransactionID = receipt.TransactionID
						order.Status = Failed
					}
				}
			case Drawing:
				game, resolveErr := s.games.Resolve(req.GameID, order.Before.Version)
				if resolveErr == nil && game.Type() != order.RuleType {
					resolveErr = fmt.Errorf("order rule type mismatch")
				}
				var result runtime.Result
				if resolveErr == nil {
					result, resolveErr = game.Draw(ctx, runtime.Request{BetMinorUnits: req.BetMinorUnits, State: order.Before})
				}
				if resolveErr == nil {
					resolveErr = result.Validate()
				}
				if resolveErr == nil {
					resolveErr = game.ValidateStoredResult(result)
				}
				if resolveErr == nil && (result.GameID != req.GameID || result.ChargeMinorUnits != req.BetMinorUnits || result.WinMinorUnits < 0 || result.Version != game.Version() || result.RuleType != game.Type()) {
					resolveErr = fmt.Errorf("invalid engine settlement")
				}
				if resolveErr != nil {
					order.FailureCode = "spin_failed"
					order.LastError = resolveErr.Error()
					if req.BetMinorUnits > 0 {
						order.Status = RefundPending
					} else {
						order.Status = Failed
					}
				} else {
					order.Result = &result
					if result.WinMinorUnits > 0 {
						order.Status = CreditPending
					} else {
						order.Status = Settled
					}
				}
			default:
				return fmt.Errorf("invalid order status %q", order.Status)
			}
			// In particular, the result and credit intent are durable BEFORE any platform credit.
			if err = store.SaveOrder(ctx, order, order.Status == Settled); err != nil {
				return fmt.Errorf("%w: %v", ErrProcessing, err)
			}
			response = order.response()
		}
		return order.failure()
	})
	return response, err
}
func (o Order) response() Response {
	r := Response{RoundID: o.RoundID, RequestID: o.Request.RequestID, Status: o.Status, PlatformBalanceMinorUnits: o.PlatformBalanceMinorUnits}
	if o.Status == Settled {
		r.Result = o.Result
	}
	return r
}
func (o Order) failure() error {
	if o.Status != Failed {
		return nil
	}
	if o.FailureCode == "debit_rejected" {
		return ErrDebitRejected
	}
	return ErrSpinFailed
}
func (o Order) transfer() platform.Transfer {
	action := platform.Debit
	amount := o.Request.BetMinorUnits
	suffix := ":debit"
	related := ""
	if o.Status == CreditPending {
		action = platform.Credit
		suffix = ":credit"
		amount = o.Result.WinMinorUnits
	}
	if o.Status == RefundPending {
		action = platform.Refund
		suffix = ":refund"
		related = o.RoundID + ":debit"
	}
	return platform.Transfer{ID: o.RoundID + suffix, Subject: o.Request.Player.Subject, GameID: o.Request.GameID, RoundID: o.RoundID, Currency: o.Request.Player.Currency, Action: action, AmountMinorUnits: amount, RelatedID: related}
}

// Resume is the recovery entry point for a reconciliation task. It uses the stored request,
// including the original verified identity/currency, rather than reconstructing it from a client.
// A production worker must authenticate/authorize its caller and enumerate durable pending orders.
func (s *Service) Resume(ctx context.Context, subject identity.Subject, requestID string) (Response, error) {
	var req Request
	err := s.store.WithSubject(ctx, subject, func(store LockedStore) error {
		o, ok, err := store.FindOrder(ctx, requestID)
		if err != nil {
			return err
		}
		if !ok {
			return ErrInvalidRequest
		}
		req = o.Request
		return nil
	})
	if err != nil {
		return Response{}, err
	}
	return s.Bet(ctx, req)
}
