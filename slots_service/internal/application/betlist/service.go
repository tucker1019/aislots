// Package betlist selects explicit game/country/currency stakes, with optional application overrides.
package betlist

import (
	"aislots/slots_service/internal/domain/identity"
	"context"
	"errors"
	"fmt"
)

var ErrUnavailable = errors.New("bet list not configured")
var ErrNotAllowed = errors.New("stake not in configured bet list")

type Policy struct {
	AppName     string  `json:"appname"`
	AppKey      string  `json:"appkey"`
	GameID      string  `json:"gameId"`
	Country     string  `json:"country"`
	Currency    string  `json:"currency"`
	AmountScale int     `json:"amountScale"`
	Amounts     []int64 `json:"amounts"`
	Default     int64   `json:"default"`
	LineCount   int     `json:"lineCount"`
	BetLevel    int     `json:"betLevel"`
}
type key struct{ appName, appKey, gameID, country, currency string }
type Service struct{ policies map[key]Policy }

func New(policies []Policy) (*Service, error) {
	s := &Service{policies: map[key]Policy{}}
	for _, p := range policies {
		if p.LineCount == 0 {
			p.LineCount = 1
		}
		if p.BetLevel == 0 {
			p.BetLevel = 1
		}
		if p.GameID == "" || p.Country == "" || p.Currency == "" || (p.AppName == "") != (p.AppKey == "") || p.AmountScale < 0 || p.AmountScale > 9 || len(p.Amounts) == 0 || p.LineCount < 1 || p.BetLevel < 1 {
			return nil, fmt.Errorf("invalid bet policy")
		}
		seen := map[int64]bool{}
		for _, a := range p.Amounts {
			if a < 1 || seen[a] {
				return nil, fmt.Errorf("invalid or duplicate stake")
			}
			seen[a] = true
		}
		if !seen[p.Default] {
			return nil, fmt.Errorf("default stake must be in list")
		}
		k := key{p.AppName, p.AppKey, p.GameID, p.Country, p.Currency}
		if _, ok := s.policies[k]; ok {
			return nil, fmt.Errorf("duplicate bet policy")
		}
		p.Amounts = append([]int64(nil), p.Amounts...)
		s.policies[k] = p
	}
	return s, nil
}

// List takes a verified context; clients cannot pick their own country/currency on a bet.
func (s *Service) List(ctx context.Context, player identity.Context, gameID string) (Policy, error) {
	if err := ctx.Err(); err != nil {
		return Policy{}, err
	}
	if !player.Valid() {
		return Policy{}, ErrUnavailable
	}
	p, ok := s.policies[key{player.Subject.AppName, player.Subject.AppKey, gameID, player.Country, player.Currency}]
	if !ok {
		p, ok = s.policies[key{"", "", gameID, player.Country, player.Currency}]
	}
	if !ok {
		return Policy{}, ErrUnavailable
	}
	p.Amounts = append([]int64(nil), p.Amounts...)
	return p, nil
}
func (s *Service) Allowed(ctx context.Context, player identity.Context, gameID string, amount int64) error {
	p, err := s.List(ctx, player, gameID)
	if err != nil {
		return err
	}
	for _, a := range p.Amounts {
		if a == amount {
			return nil
		}
	}
	return ErrNotAllowed
}
