package model

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/config"
)

func TestAgentDailyDifferentialAndClaim(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	now := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
	created := now.Add(-48 * time.Hour)
	cfg := config.AgentConfig{Version: "v1", Providers: map[string][]config.AgentTier{"AG": {{Threshold: 100, Rate: 30}, {Threshold: 10000000, Rate: 60}, {Threshold: 300000000, Rate: 100}}, "PG": {{Threshold: 100, Rate: 10}}}}
	m := &AgentModel{DB: db, Config: cfg, Games: map[string]config.GameEntry{"AG1": {Provider: "AG"}, "PG1": {Provider: "PG"}}, Location: time.UTC}
	ids := map[string]int64{}
	for _, name := range []string{"A", "B1", "B2", "B3", "C1", "C2", "C3", "outside"} {
		u := LobbyUser{Nickname: name, AvatarID: 1, CreatedAt: created}
		if e := db.Create(&u).Error; e != nil {
			t.Fatal(e)
		}
		ids[name] = u.UID
		if e := db.Create(&LobbyWalletBalance{UID: u.UID}).Error; e != nil {
			t.Fatal(e)
		}
	}
	for _, pair := range [][2]string{{"B1", "A"}, {"B2", "A"}, {"B3", "A"}, {"C1", "B1"}, {"C2", "B1"}, {"C3", "B3"}} {
		child, parent := pair[0], pair[1]
		if e := db.Create(&LobbyInviteRelation{InviteeUID: ids[child], InviterUID: ids[parent], RegisteredAt: created, Deadline: now.Add(time.Hour), ConfigVersion: "x", MinDepositCount: 1, MinDepositAmount: 1, MinBetAmount: 1, RewardAmount: 1}).Error; e != nil {
			t.Fatal(e)
		}
	}
	at := now.Add(-24 * time.Hour)
	for name, amount := range map[string]int64{"B1": 12000000, "B2": 4000000, "B3": 2000000, "C1": 10000000, "C2": 3000000, "C3": 300000000} {
		if e := db.Create(&LobbyActivityEvent{EventID: name, UID: ids[name], EventType: EventGameBet, GameID: "AG1", Amount: amount, OccurredAt: at, BusinessDate: at.Format(time.DateOnly)}).Error; e != nil {
			t.Fatal(e)
		}
	}
	if e := m.Tick(ctx, now); e != nil {
		t.Fatal(e)
	}
	for name, want := range map[string]int64{"A": 232000, "B1": 78000, "B2": 0, "B3": 3000000} {
		v, e := m.Query(ctx, AgentQuery{UID: ids[name], Period: "yesterday", Action: "center", Page: 1}, now)
		if e != nil {
			t.Fatal(e)
		}
		if v.Summary.Commission != want || v.Summary.Claimable != want {
			t.Fatalf("%s: %+v expected %d", name, v.Summary, want)
		}
	}
	v, e := m.Query(ctx, AgentQuery{UID: ids["A"], Period: "yesterday", Action: "performance-details", Page: 1}, now)
	if e != nil {
		t.Fatal(e)
	}
	var total int64
	for _, r := range v.Items {
		total += r.Commission
	}
	if total != 232000 {
		t.Fatal(total)
	}
	if _, e = m.Query(ctx, AgentQuery{UID: ids["B1"], TargetUID: ids["outside"], Period: "today", Action: "team", Page: 1}, now); e == nil {
		t.Fatal("outside subtree allowed")
	}
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(i int) { defer wg.Done(); _, err := m.Claim(ctx, ids["A"], fmt.Sprint(i), now); results <- err }(i)
	}
	wg.Wait()
	close(results)
	success := 0
	for e := range results {
		if e == nil {
			success++
		}
	}
	if success != 1 {
		t.Fatal(success)
	}
	var receipt LobbyAgentClaim
	if e = db.Where("uid=?", ids["A"]).Take(&receipt).Error; e != nil {
		t.Fatal(e)
	}
	retry, e := m.Claim(ctx, ids["A"], receipt.RequestID, now.Add(time.Hour))
	if e != nil || retry.ClaimID != receipt.ClaimID || retry.Coins != 232000 {
		t.Fatal(retry, e)
	}
	var ledger int64
	db.Model(&LobbyCoinLedger{}).Where("uid=?", ids["A"]).Count(&ledger)
	if ledger != 1 {
		t.Fatal(ledger)
	}
	for game, amount := range map[string]int64{"AG1": 100000, "PG1": 100000} {
		if e = db.Create(&LobbyActivityEvent{EventID: game, UID: ids["C1"], EventType: EventGameBet, GameID: game, Amount: amount, OccurredAt: now, BusinessDate: now.Format(time.DateOnly)}).Error; e != nil {
			t.Fatal(e)
		}
	}
	if e = m.Tick(ctx, now); e != nil {
		t.Fatal(e)
	}
	v, e = m.Query(ctx, AgentQuery{UID: ids["A"], Period: "today", Action: "performance", Page: 1}, now)
	if e != nil || v.Summary.Claimable != 0 {
		t.Fatal(v, e)
	}
	for _, r := range v.Items {
		if r.Commission != 0 {
			t.Fatal("equal parent/child rates must earn no spread", r)
		}
	}
	// Subsequent same-day jobs increment the baseline exactly once.
	extra := LobbyActivityEvent{EventID: "incremental-direct", UID: ids["B2"], EventType: EventGameBet, GameID: "AG1", Amount: 100000, OccurredAt: now, BusinessDate: now.Format(time.DateOnly)}
	if e = db.Create(&extra).Error; e != nil {
		t.Fatal(e)
	}
	if e = m.Tick(ctx, now); e != nil {
		t.Fatal(e)
	}
	if e = m.Tick(ctx, now); e != nil {
		t.Fatal(e)
	}
	inc, e := m.Query(ctx, AgentQuery{UID: ids["A"], Period: "today", Action: "performance", Provider: "AG", Page: 1}, now)
	if e != nil || inc.Summary.ValidBet != 200000 || inc.Summary.Commission != 300 {
		t.Fatal(inc, e)
	}
	if e = m.Tick(ctx, now.Add(24*time.Hour)); e != nil {
		t.Fatal(e)
	}
	for _, kind := range []string{"team", "bets", "first-deposit", "deposit", "withdrawal"} {
		if _, e = m.Query(ctx, AgentQuery{UID: ids["A"], Period: "yesterday", Action: "report-details", Kind: kind, Page: 1}, now); e != nil {
			t.Fatal(kind, e)
		}
	}
}

func TestAgentDeepBindingRoundingSnapshotsAndDeposits(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	now := time.Date(2026, 11, 4, 12, 0, 0, 0, time.UTC)
	at := now.Add(-24 * time.Hour)
	bound := at.Add(-time.Hour)
	m := &AgentModel{DB: db, Config: config.AgentConfig{Version: "v1", Providers: map[string][]config.AgentTier{"AG": {{Threshold: 1, Rate: 33}}}}, Games: map[string]config.GameEntry{"AG1": {Provider: "AG"}}, Location: time.UTC}
	create := func(name string) int64 {
		t.Helper()
		u := LobbyUser{Nickname: name, AvatarID: 1, CreatedAt: bound}
		if e := db.Create(&u).Error; e != nil {
			t.Fatal(e)
		}
		if e := db.Create(&LobbyWalletBalance{UID: u.UID}).Error; e != nil {
			t.Fatal(e)
		}
		return u.UID
	}
	bind := func(parent, child int64) {
		t.Helper()
		if e := db.Create(&LobbyInviteRelation{InviteeUID: child, InviterUID: parent, RegisteredAt: bound, Deadline: now, ConfigVersion: "v1", MinDepositCount: 1, MinDepositAmount: 1, MinBetAmount: 1, RewardAmount: 1}).Error; e != nil {
			t.Fatal(e)
		}
	}
	event := func(id string, uid, amount int64, occurred time.Time) {
		t.Helper()
		if e := db.Create(&LobbyActivityEvent{EventID: id, UID: uid, EventType: EventGameBet, GameID: "AG1", Amount: amount, OccurredAt: occurred, BusinessDate: occurred.Format(time.DateOnly)}).Error; e != nil {
			t.Fatal(e)
		}
	}
	root := create("root")
	var members []int64
	for i := 0; i < 4; i++ {
		u := create(fmt.Sprint(i))
		bind(root, u)
		members = append(members, u)
		event(fmt.Sprint(i), u, 101, at)
	}
	// Before binding is excluded, even when in the same calendar day.
	event("before-binding", members[0], 1000000, bound.Add(-time.Minute))
	parent := create("chain-root")
	chainRoot := parent
	for i := 0; i < 9; i++ {
		u := create(fmt.Sprint("deep-", i))
		bind(parent, u)
		parent = u
	}
	event("deep", parent, 10000, at)
	if e := m.Tick(ctx, now); e != nil {
		t.Fatal(e)
	}
	v, e := m.Query(ctx, AgentQuery{UID: root, Period: "yesterday", Action: "performance-details", Page: 1}, now)
	if e != nil {
		t.Fatal(e)
	}
	if v.Summary.ValidBet != 404 || v.Summary.Commission != 1 {
		t.Fatal(v.Summary)
	}
	var sum int64
	for _, r := range v.Items {
		sum += r.Commission
	}
	if sum != 1 {
		t.Fatal(sum)
	}
	deep, e := m.Query(ctx, AgentQuery{UID: chainRoot, Period: "yesterday", Action: "performance-details", Page: 1}, now)
	if e != nil || len(deep.Items) != 1 || deep.Items[0].Depth != 9 {
		t.Fatal(deep, e)
	}
	// Later config must not change already-snapshotted day rules during a safe pre-claim rebuild.
	m.Config.Providers["AG"][0].Rate = 99
	if e = db.Exec(`INSERT INTO lobby_agent_queue(business_date,event_id) VALUES(?,?)`, at.Format(time.DateOnly), "rebuild").Error; e != nil {
		t.Fatal(e)
	}
	if e = m.Tick(ctx, now); e != nil {
		t.Fatal(e)
	}
	v, e = m.Query(ctx, AgentQuery{UID: root, Period: "yesterday", Action: "center", Page: 1}, now)
	if e != nil || v.Summary.Commission != 1 {
		t.Fatal(v, e)
	}
	// Successful first principal only. A pending order and the bonus do not count.
	for i, status := range []string{"success", "success", "pending"} {
		settled := at.Add(time.Duration(i) * time.Minute)
		o := LobbyRechargeOrder{UID: members[0], OrderID: fmt.Sprint("deposit", i), RequestID: fmt.Sprint(i), TierID: "test", Amount: 1000, Bonus: 100, CreditAmount: 1100, Status: status, CreatedAt: settled, SettledAt: &settled, SettleAt: settled}
		if e = db.Create(&o).Error; e != nil {
			t.Fatal(e)
		}
	}
	report, e := m.Query(ctx, AgentQuery{UID: root, Period: "yesterday", Action: "report", Page: 1}, now)
	if e != nil || report.Summary.FirstDepositCount != 1 || report.Summary.FirstDepositAmount != 1000 || report.Summary.DepositAmount != 2000 || report.Summary.DepositCount != 1 {
		t.Fatal(report, e)
	}
	// Claim ledger failures roll back the receipt, flags and balance; the same ID remains retryable.
	if e = db.Exec(`CREATE FUNCTION reject_agent_ledger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$; CREATE TRIGGER reject_agent_ledger BEFORE INSERT ON lobby_coin_ledger FOR EACH ROW EXECUTE FUNCTION reject_agent_ledger()`).Error; e != nil {
		t.Fatal(e)
	}
	if _, e = m.Claim(ctx, root, "rollback", now); e == nil {
		t.Fatal("expected failure")
	}
	var n int64
	db.Model(&LobbyAgentClaim{}).Where("uid=?", root).Count(&n)
	if n != 0 {
		t.Fatal("receipt leaked")
	}
	if e = db.Exec(`DROP TRIGGER reject_agent_ledger ON lobby_coin_ledger`).Error; e != nil {
		t.Fatal(e)
	}
	if r, e := m.Claim(ctx, root, "rollback", now); e != nil || r.Amount != 1 {
		t.Fatal(r, e)
	}
	// A later historical correction cannot rewrite a paid receipt, and its durable job is retained.
	event("late-correction", members[0], 1000, at)
	if e = m.Tick(ctx, now); e == nil {
		t.Fatal("paid historical correction must remain visible for reconciliation")
	}
	db.Table("lobby_agent_queue").Where("event_id=?", "late-correction").Count(&n)
	if n != 1 {
		t.Fatal("lost correction")
	}
}
