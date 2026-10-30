// Package memory stores platform-scoped game orders/state for development. There are no accounts or wallets.
// Data and locks are process-local and non-durable; production requires a durable order store.
package memory

import (
	"aislots/slots_service/internal/application/bet"
	"aislots/slots_service/internal/domain/identity"
	"aislots/slots_service/internal/engine"
	"context"
	"encoding/json"
	"fmt"
	"sync"
)

type subjectData struct {
	gate   chan struct{}
	states map[bet.StateKey]engine.State
	orders map[string]bet.Order
}
type Store struct {
	mu       sync.Mutex
	subjects map[identity.Subject]*subjectData
}

func New() *Store { return &Store{subjects: map[identity.Subject]*subjectData{}} }
func (s *Store) WithSubject(ctx context.Context, subject identity.Subject, fn func(bet.LockedStore) error) error {
	if !subject.Valid() {
		return bet.ErrInvalidRequest
	}
	if err := ctx.Err(); err != nil {
		return err
	}
	s.mu.Lock()
	d := s.subjects[subject]
	if d == nil {
		d = &subjectData{gate: make(chan struct{}, 1), states: map[bet.StateKey]engine.State{}, orders: map[string]bet.Order{}}
		d.gate <- struct{}{}
		s.subjects[subject] = d
	}
	s.mu.Unlock()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-d.gate:
	}
	defer func() { d.gate <- struct{}{} }()
	// Each SaveOrder commits immediately. Callback errors MUST NOT roll back prior intents.
	return fn(&locked{data: d, subject: subject})
}

type locked struct {
	data    *subjectData
	subject identity.Subject
}

func (l *locked) FindOrder(ctx context.Context, key string) (bet.Order, bool, error) {
	if err := ctx.Err(); err != nil {
		return bet.Order{}, false, err
	}
	o, ok := l.data.orders[key]
	if !ok {
		return bet.Order{}, false, nil
	}
	copy, err := clone(o)
	return copy, true, err
}
func (l *locked) FindPending(ctx context.Context) (bet.Order, bool, error) {
	if err := ctx.Err(); err != nil {
		return bet.Order{}, false, err
	}
	for _, o := range l.data.orders {
		if !o.Status.Terminal() {
			copy, err := clone(o)
			return copy, true, err
		}
	}
	return bet.Order{}, false, nil
}
func (l *locked) LoadState(ctx context.Context, key bet.StateKey) (engine.State, error) {
	if err := ctx.Err(); err != nil {
		return engine.State{}, err
	}
	return clone(l.data.states[key])
}
func (l *locked) SaveOrder(ctx context.Context, o bet.Order, commitState bool) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if o.Request.Player.Subject != l.subject || o.RoundID == "" || o.Request.RequestID == "" {
		return fmt.Errorf("invalid order ownership")
	}
	previous, ok := l.data.orders[o.Request.RequestID]
	if ok {
		if previous.Request != o.Request || previous.RoundID != o.RoundID {
			return bet.ErrRequestConflict
		}
		if previous.Status.Terminal() {
			return fmt.Errorf("terminal order immutable")
		}
	}
	if commitState && (o.Status != bet.Settled || o.Result == nil) {
		return fmt.Errorf("only settled result may commit state")
	}
	copy, err := clone(o)
	if err != nil {
		return err
	}
	l.data.orders[o.Request.RequestID] = copy
	if commitState {
		l.data.states[o.Request.StateKey()] = copy.Result.NextState
	}
	return nil
}
func clone[T any](value T) (T, error) {
	var out T
	b, err := json.Marshal(value)
	if err != nil {
		return out, err
	}
	err = json.Unmarshal(b, &out)
	return out, err
}
