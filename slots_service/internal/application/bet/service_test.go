package bet_test

import (
	"aislots/slots_service/internal/application/bet"
	"aislots/slots_service/internal/application/betlist"
	runtime "aislots/slots_service/internal/domain/game"
	"aislots/slots_service/internal/domain/identity"
	"aislots/slots_service/internal/engine"
	"aislots/slots_service/internal/games/ag1"
	"aislots/slots_service/internal/infrastructure/memory"
	adapters "aislots/slots_service/internal/infrastructure/platform"
	"aislots/slots_service/internal/platform"
	"context"
	"encoding/json"
	"errors"
	"reflect"
	"sync"
	"sync/atomic"
	"testing"
)

type fakeGame struct {
	calls atomic.Int64
	fail  bool
	free  bool
}

func (g *fakeGame) Type() string    { return "test_v1" }
func (g *fakeGame) Version() string { return "v1" }
func (g *fakeGame) Draw(ctx context.Context, r runtime.Request) (runtime.Result, error) {
	g.calls.Add(1)
	if g.fail {
		return runtime.Result{}, engine.ErrFill
	}
	state := r.State
	var data struct {
		Sequence uint64 `json:"sequence"`
	}
	if len(state.Payload) > 0 {
		if err := json.Unmarshal(state.Payload, &data); err != nil {
			return runtime.Result{}, err
		}
	}
	data.Sequence++
	payload, _ := json.Marshal(data)
	state = runtime.State{RuleType: g.Type(), Version: g.Version(), SchemaVersion: 1, Pending: g.free && !state.Pending, Payload: payload}
	action := "complete"
	if state.Pending {
		action = "start_bonus"
	}
	return runtime.Result{Frames: []runtime.Frame{{WinMinorUnits: 40, NextAction: action, Payload: json.RawMessage(`{}`)}}, SchemaVersion: 1, RuleType: g.Type(), GameID: "AG1", Version: g.Version(), BetMinorUnits: 100, ChargeMinorUnits: r.BetMinorUnits, WinMinorUnits: 40, NextState: state, Payload: json.RawMessage(`{}`)}, nil
}
func (g *fakeGame) ValidateStoredResult(runtime.Result) error { return nil }
func (g *fakeGame) Present(runtime.Result, runtime.FrameContext) (json.RawMessage, error) {
	return nil, nil
}
func sequence(s runtime.State) uint64 {
	var data struct{ Sequence uint64 }
	_ = json.Unmarshal(s.Payload, &data)
	return data.Sequence
}
func rawMultiplier(r *runtime.Result) string {
	var old engine.SpinResult
	_ = json.Unmarshal(r.Payload, &old)
	return old.Round.RawMultiplier
}

type games struct{ g bet.Spinner }

func (g games) Resolve(id, version string) (bet.Spinner, error) {
	if id != "AG1" || version != "" && version != g.g.Version() {
		return nil, bet.ErrGameUnavailable
	}
	return g.g, nil
}

type fakePlatform struct {
	mu           sync.Mutex
	receipts     map[string]platform.Receipt
	calls        map[platform.Action]int
	transfers    []platform.Transfer
	timeoutOnce  platform.Action
	reject       platform.Action
	queryUnknown bool
}

func newPlatform() *fakePlatform {
	return &fakePlatform{receipts: map[string]platform.Receipt{}, calls: map[platform.Action]int{}}
}
func (p *fakePlatform) VerifyUser(ctx context.Context, r platform.LoginRequest) (platform.VerifiedUser, error) {
	return platform.VerifiedUser{Context: identity.Context{Subject: r.Subject, Country: "ID", Currency: "IDR"}}, nil
}
func (p *fakePlatform) QueryTransfer(ctx context.Context, t platform.Transfer) (platform.Receipt, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.queryUnknown {
		return platform.Receipt{Status: platform.Unknown}, nil
	}
	if r, ok := p.receipts[t.ID]; ok {
		return r, nil
	}
	return platform.Receipt{Status: platform.NotFound}, nil
}
func (p *fakePlatform) Transfer(ctx context.Context, t platform.Transfer) (platform.Receipt, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.calls[t.Action]++
	p.transfers = append(p.transfers, t)
	if r, ok := p.receipts[t.ID]; ok {
		return r, nil
	}
	status := platform.Confirmed
	if p.reject == t.Action {
		status = platform.Rejected
	}
	r := platform.Receipt{Status: status, TransactionID: "remote:" + t.ID}
	p.receipts[t.ID] = r
	if p.timeoutOnce == t.Action {
		p.timeoutOnce = ""
		return platform.Receipt{}, errors.New("response lost after remote commit")
	}
	return r, nil
}
func request() bet.Request {
	return bet.Request{Player: identity.Context{Subject: identity.Subject{AppName: "platform-a", AppKey: "app-1", UID: "u1"}, Country: "ID", Currency: "IDR"}, RequestID: "request-1", GameID: "AG1", BetMinorUnits: 100}
}
func setup(t *testing.T, g *fakeGame, p *fakePlatform, store bet.Store) *bet.Service {
	t.Helper()
	registry, err := adapters.NewRegistry(map[adapters.App]platform.Client{{AppName: "platform-a", AppKey: "app-1"}: p, {AppName: "platform-a", AppKey: "app-2"}: p, {AppName: "platform-b", AppKey: "app-1"}: p})
	if err != nil {
		t.Fatal(err)
	}
	policies, err := betlist.New([]betlist.Policy{{GameID: "AG1", Country: "ID", Currency: "IDR", Amounts: []int64{100, 200}, Default: 100}})
	if err != nil {
		t.Fatal(err)
	}
	s, err := bet.New(games{g}, store, registry, policies)
	if err != nil {
		t.Fatal(err)
	}
	return s
}
func TestConcurrentDuplicateSettlesOnce(t *testing.T) {
	g, p := &fakeGame{}, newPlatform()
	s := setup(t, g, p, memory.New())
	var wg sync.WaitGroup
	out := make(chan bet.Response, 30)
	for i := 0; i < 30; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r, err := s.Bet(context.Background(), request())
			if err != nil {
				t.Error(err)
				return
			}
			out <- r
		}()
	}
	wg.Wait()
	close(out)
	var first *bet.Response
	for r := range out {
		if first == nil {
			copy := r
			first = &copy
		}
		if !reflect.DeepEqual(r, *first) {
			t.Fatal("duplicate changed response")
		}
	}
	if first == nil || first.Status != bet.Settled || g.calls.Load() != 1 || p.calls[platform.Debit] != 1 || p.calls[platform.Credit] != 1 {
		t.Fatal("duplicate settlement", first, p.calls)
	}
	req := request()
	req.BetMinorUnits = 200
	if _, err := s.Bet(context.Background(), req); !errors.Is(err, bet.ErrRequestConflict) {
		t.Fatal(err)
	}
}
func TestPlatformAndApplicationIsolation(t *testing.T) {
	g, p := &fakeGame{}, newPlatform()
	s := setup(t, g, p, memory.New())
	for _, subject := range []identity.Subject{{AppName: "platform-a", AppKey: "app-1", UID: "u1"}, {AppName: "platform-a", AppKey: "app-2", UID: "u1"}, {AppName: "platform-b", AppKey: "app-1", UID: "u1"}, {AppName: "platform-a", AppKey: "app-1", UID: "u2"}} {
		req := request()
		req.Player.Subject = subject
		r, err := s.Bet(context.Background(), req)
		if err != nil || sequence(r.Result.NextState) != 1 {
			t.Fatal("identity state leaked", r, err)
		}
	}
	if g.calls.Load() != 4 || p.calls[platform.Debit] != 4 {
		t.Fatal("identities merged")
	}
}
func TestTimeoutRecoversWithoutDuplicateTransfer(t *testing.T) {
	for _, action := range []platform.Action{platform.Debit, platform.Credit} {
		t.Run(string(action), func(t *testing.T) {
			g, p := &fakeGame{}, newPlatform()
			p.timeoutOnce = action
			store := memory.New()
			s := setup(t, g, p, store)
			r, err := s.Bet(context.Background(), request())
			if !errors.Is(err, bet.ErrProcessing) || r.Status == bet.Settled {
				t.Fatal(r, err)
			}
			if action == platform.Debit && g.calls.Load() != 0 {
				t.Fatal("drew before debit confirmation")
			}
			next := request()
			next.RequestID = "another"
			if _, err = s.Bet(context.Background(), next); !errors.Is(err, bet.ErrProcessing) {
				t.Fatal("new bet bypassed pending round", err)
			}
			r, err = s.Bet(context.Background(), request())
			if err != nil || r.Status != bet.Settled || sequence(r.Result.NextState) != 1 || g.calls.Load() != 1 || p.calls[platform.Debit] != 1 || p.calls[platform.Credit] != 1 {
				t.Fatal("recovery duplicated operation", r, err, p.calls)
			}
		})
	}
}
func TestRejectedDebitDoesNotDraw(t *testing.T) {
	g, p := &fakeGame{}, newPlatform()
	p.reject = platform.Debit
	s := setup(t, g, p, memory.New())
	for i := 0; i < 2; i++ {
		r, err := s.Bet(context.Background(), request())
		if !errors.Is(err, bet.ErrDebitRejected) || r.Status != bet.Failed {
			t.Fatal(r, err)
		}
	}
	if g.calls.Load() != 0 || p.calls[platform.Credit] != 0 || p.calls[platform.Debit] != 1 {
		t.Fatal("rejected debit proceeded")
	}
}
func TestFailedSpinRefundsAndPreservesState(t *testing.T) {
	g, p := &fakeGame{fail: true}, newPlatform()
	p.timeoutOnce = platform.Refund
	store := memory.New()
	s := setup(t, g, p, store)
	if _, err := s.Bet(context.Background(), request()); !errors.Is(err, bet.ErrProcessing) {
		t.Fatal(err)
	}
	r, err := s.Bet(context.Background(), request())
	if !errors.Is(err, bet.ErrSpinFailed) || r.Status != bet.Failed || p.calls[platform.Refund] != 1 || g.calls.Load() != 1 {
		t.Fatal(r, err)
	}
	if len(p.transfers) != 2 || p.transfers[1].RelatedID != p.transfers[0].ID {
		t.Fatal("refund not linked")
	}
	g.fail = false
	req := request()
	req.RequestID = "next"
	r, err = s.Bet(context.Background(), req)
	if err != nil || sequence(r.Result.NextState) != 1 {
		t.Fatal("failed bet advanced state", r, err)
	}
}
func TestFreeSpinSkipsDebit(t *testing.T) {
	g, p := &fakeGame{free: true}, newPlatform()
	s := setup(t, g, p, memory.New())
	req := request()
	paid, err := s.Bet(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	paid.Result.NextState.Version = "caller-mutated"
	paid.Result.NextState.Payload[0] = 'x' // Must not mutate persisted state.
	req.RequestID = "free"
	req.BetMinorUnits = 0
	r, err := s.Bet(context.Background(), req)
	if err != nil || r.Result.NextState.Pending || p.calls[platform.Debit] != 1 || p.calls[platform.Credit] != 2 {
		t.Fatal("free settlement wrong", r, err, p.calls)
	}
}

type failStore struct {
	bet.Store
	once atomic.Bool
}
type failLocked struct {
	bet.LockedStore
	owner *failStore
}

func (s *failStore) WithSubject(ctx context.Context, id identity.Subject, fn func(bet.LockedStore) error) error {
	return s.Store.WithSubject(ctx, id, func(l bet.LockedStore) error { return fn(failLocked{l, s}) })
}
func (s failLocked) SaveOrder(ctx context.Context, o bet.Order, commit bool) error {
	if commit && !s.owner.once.Swap(true) {
		return errors.New("database commit unavailable")
	}
	return s.LockedStore.SaveOrder(ctx, o, commit)
}
func TestCreditSuccessLocalSaveFailureRecovers(t *testing.T) {
	g, p := &fakeGame{}, newPlatform()
	s := setup(t, g, p, &failStore{Store: memory.New()})
	if _, err := s.Bet(context.Background(), request()); !errors.Is(err, bet.ErrProcessing) {
		t.Fatal(err)
	}
	r, err := s.Bet(context.Background(), request())
	if err != nil || r.Status != bet.Settled || p.calls[platform.Credit] != 1 || g.calls.Load() != 1 {
		t.Fatal("duplicated credit or result", r, err)
	}
}
func TestUnknownLookupNeverSubmitsTransfer(t *testing.T) {
	g, p := &fakeGame{}, newPlatform()
	p.queryUnknown = true
	s := setup(t, g, p, memory.New())
	if _, err := s.Bet(context.Background(), request()); !errors.Is(err, bet.ErrProcessing) {
		t.Fatal(err)
	}
	if len(p.transfers) != 0 || g.calls.Load() != 0 {
		t.Fatal("unknown transaction resubmitted")
	}
}

func TestRecoveryEntryUsesStoredRequest(t *testing.T) {
	g, p := &fakeGame{}, newPlatform()
	p.timeoutOnce = platform.Credit
	s := setup(t, g, p, memory.New())
	req := request()
	if _, err := s.Bet(context.Background(), req); !errors.Is(err, bet.ErrProcessing) {
		t.Fatal(err)
	}
	r, err := s.Resume(context.Background(), req.Player.Subject, req.RequestID)
	if err != nil || r.Status != bet.Settled || g.calls.Load() != 1 {
		t.Fatal(r, err)
	}
	other := req.Player.Subject
	other.AppKey = "other"
	if _, err = s.Resume(context.Background(), other, req.RequestID); !errors.Is(err, bet.ErrInvalidRequest) {
		t.Fatal("recovery crossed application boundary", err)
	}
}
func TestRejectedCreditRemainsPending(t *testing.T) {
	g, p := &fakeGame{}, newPlatform()
	p.reject = platform.Credit
	s := setup(t, g, p, memory.New())
	r, err := s.Bet(context.Background(), request())
	if !errors.Is(err, bet.ErrProcessing) || r.Status != bet.CreditPending || r.Result != nil {
		t.Fatal("credit rejection must not settle or expose result", r, err)
	}
	if _, err = s.Resume(context.Background(), request().Player.Subject, request().RequestID); !errors.Is(err, bet.ErrProcessing) {
		t.Fatal(err)
	}
	if g.calls.Load() != 1 || p.calls[platform.Credit] != 1 {
		t.Fatal("rejected credit retried as new transfer")
	}
}
func TestInvalidStakeNeverCallsPlatform(t *testing.T) {
	g, p := &fakeGame{}, newPlatform()
	s := setup(t, g, p, memory.New())
	req := request()
	req.BetMinorUnits = 123
	if _, err := s.Bet(context.Background(), req); !errors.Is(err, betlist.ErrNotAllowed) {
		t.Fatal(err)
	}
	if g.calls.Load() != 0 || len(p.transfers) != 0 {
		t.Fatal("invalid stake caused side effect")
	}
}

func TestOrderFlowWithRealEngine(t *testing.T) {
	n := 0.0
	limit := 0
	game := engine.Game{ID: "AG1", Parameters: engine.Parameters{LineCount: 20, BaseWin: 1, FreeWin: 1, Awards: [][2]float64{{2, 1}}, RetriggerLimit: &limit}, Board: engine.BoardConfig{Version: 1, ColumnHeights: []int{2, 2, 2}, Symbols: []engine.Symbol{{ID: "1", Role: "normal", Weight: 1, Payouts: map[int]json.Number{3: "2"}}, {ID: "2", Role: "normal", Weight: 1, Payouts: map[int]json.Number{}}}, CascadeFactors: []json.Number{"1"}, FreeCascadeFactors: []json.Number{"2"}, FillWeightIncrement: &n, ScatterWeightIncrement: &n}, BaseRows: []engine.WeightRow{{"2", "1"}}, FreeRows: []engine.WeightRow{{"4", "1"}}}
	skeleton := []int{3, 0, 1, 2, 1, 4, 1, 0}
	lib := engine.NewMemoryLibrary(map[engine.Mode]map[string][][]int{engine.Base: {"2": {skeleton}}, engine.Free: {"4": {skeleton}}})
	actual, err := engine.NewEngine(game, lib, engine.Options{TriggerSymbolCount: 3, Random: func() (float64, error) { return .99, nil }})
	if err != nil {
		t.Fatal(err)
	}
	p := newPlatform()
	registry, err := adapters.NewRegistry(map[adapters.App]platform.Client{{AppName: "platform-a", AppKey: "app-1"}: p})
	if err != nil {
		t.Fatal(err)
	}
	policies, err := betlist.New([]betlist.Policy{{GameID: "AG1", Country: "ID", Currency: "IDR", Amounts: []int64{100}, Default: 100}})
	if err != nil {
		t.Fatal(err)
	}

	s, err := bet.New(games{ag1.New(actual)}, memory.New(), registry, policies)
	if err != nil {
		t.Fatal(err)
	}
	first, err := s.Bet(context.Background(), request())
	if err != nil {
		t.Fatal(err)
	}
	if first.Result.WinMinorUnits != 10 || rawMultiplier(first.Result) != "2" || sequence(first.Result.NextState) != 1 || p.transfers[0].AmountMinorUnits != 100 || p.transfers[1].AmountMinorUnits != 10 {
		t.Fatal("engine/platform amounts differ", first)
	}
	again, err := s.Bet(context.Background(), request())
	if err != nil || !reflect.DeepEqual(first, again) || len(p.transfers) != 2 {
		t.Fatal("retry changed result", err)
	}
}
