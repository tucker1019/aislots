package model

import (
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	"apps/pkg/coinsource"
)

func TestInviteBindingQualificationAndClaim(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	cfg := config.InviteConfig{Version: "v1", DurationDays: 30, MinDepositCount: 5, MinDepositAmount: 50000, MinBetAmount: 500000, RewardAmount: 20000}
	m := &InviteModel{DB: db, Config: cfg}
	users := &UserModel{DB: db, Invite: m}
	owner, e := users.Create(ctx, "", "", "owner", time.Now().Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	v, e := m.Read(ctx, owner, time.Now())
	if e != nil {
		t.Fatal(e)
	}
	create := func(code, token string) int64 {
		t.Helper()
		id, err := users.CreateInvited(ctx, token, time.Now().Add(time.Hour), code)
		if err != nil {
			t.Fatal(err)
		}
		return id
	}
	guest := create(v.Code, "guest")

	plain := create("unknown", "plain")
	var relation LobbyInviteRelation
	if e = db.Where("invitee_uid = ?", guest).Take(&relation).Error; e != nil || relation.InviterUID != owner {
		t.Fatal(relation, e)
	}
	var count int64
	db.Model(&LobbyInviteRelation{}).Where("invitee_uid = ?", plain).Count(&count)
	if count != 0 {
		t.Fatal("invalid code bound")
	}
	if e = users.Bind(ctx, guest, "guest", "bound-account", "hash", time.Now(), time.Now().Add(time.Hour)); e != nil {
		t.Fatal(e)
	}
	// Later configuration changes cannot reprice or weaken this relation.
	m.Config.RewardAmount = 999
	m.Config.MinDepositAmount = 1
	addDeposit := func(id int64, index int, principal int64, at time.Time, status string) {
		t.Helper()
		o := LobbyRechargeOrder{OrderID: fmt.Sprintf("%d-%d", id, index), UID: id, RequestID: fmt.Sprint(index), TierID: "test", Amount: principal, Bonus: 2000, CreditAmount: principal + 2000, Status: status, CreatedAt: at, SettleAt: at, SettledAt: &at}
		if err := db.Create(&o).Error; err != nil {
			t.Fatal(err)
		}
	}
	start := relation.RegisteredAt
	end := relation.Deadline
	now := end.Add(time.Hour)
	for i := 0; i < 4; i++ {
		addDeposit(guest, i, 10000, start.Add(time.Duration(i)*time.Hour), "success")
	}
	addDeposit(guest, 10, 100000, start, "pending")
	addDeposit(guest, 11, 10000, end, "success")
	valid := int64(1)
	if e = db.Create(&LobbyActivityEvent{EventID: "bet", UID: guest, EventType: EventGameBet, GameID: "AG1", Amount: 500000, ValidBetAmount: &valid, OccurredAt: start, BusinessDate: start.Format(time.DateOnly)}).Error; e != nil {
		t.Fatal(e)
	}
	v, e = m.Read(ctx, owner, now)
	if e != nil || v.PendingAmount != 0 {
		t.Fatal("five deposits and principal required", v, e)
	}
	addDeposit(guest, 4, 9999, end.Add(-time.Second), "success")
	v, e = m.Read(ctx, owner, now)
	if e != nil || v.PendingAmount != 0 {
		t.Fatal("bonus counted as principal", v, e)
	}
	if e = db.Model(&LobbyRechargeOrder{}).Where("order_id = ?", fmt.Sprintf("%d-4", guest)).Updates(map[string]any{"amount": 10000, "credit_amount": 12000}).Error; e != nil {
		t.Fatal(e)
	}
	v, e = m.Read(ctx, owner, now)
	if e != nil || v.PendingAmount != 0 {
		t.Fatal("unbound account qualified", v, e)
	}
	if e = (&WalletAccountModel{DB: db}).SaveAccount(ctx, guest, "test1", "guest-account", "测试"); e != nil {
		t.Fatal(e)
	}
	v, e = m.Read(ctx, owner, now)
	if e != nil || v.PendingAmount != 20000 || v.QualifiedCount != 1 {
		t.Fatal("eligible historical window or snapshot", v, e)
	}
	other, e := m.Read(ctx, plain, now)
	if e != nil || other.PendingAmount != 0 {
		t.Fatal("cross user", other, e)
	}
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			b, err := m.Claim(ctx, owner, "one-request", now)
			if err != nil || b.TotalReward != 20000 {
				t.Error(b, err)
			}
		}()
	}
	wg.Wait()
	v, e = m.Read(ctx, owner, now)
	if e != nil || v.PendingAmount != 0 || v.ClaimedAmount != 20000 {
		t.Fatal(v, e)
	}
	db.Model(&LobbyCoinLedger{}).Where("uid = ? AND source = ?", owner, string(coinsource.SourceInviteReward)).Count(&count)
	if count != 1 {
		t.Fatal("duplicate ledger", count)
	}
	if _, e = m.Claim(ctx, owner, "different", now); e == nil {
		t.Fatal("reward reused")
	}
	// An unfinished bet cannot be made eligible after the deadline.
	late := create(v.Code, "late")
	if e = (&WalletAccountModel{DB: db}).SaveAccount(ctx, late, "test1", "late-account", "测试"); e != nil {
		t.Fatal(e)
	}
	var r LobbyInviteRelation
	db.Where("invitee_uid = ?", late).Take(&r)
	for i := 0; i < 5; i++ {
		addDeposit(late, i, 10000, r.RegisteredAt, "success")
	}
	db.Create(&LobbyActivityEvent{EventID: "late-bet", UID: late, EventType: EventGameBet, GameID: "AG1", Amount: 500000, OccurredAt: r.Deadline, BusinessDate: r.Deadline.Format(time.DateOnly)})
	v, e = m.Read(ctx, owner, r.Deadline.Add(time.Hour))
	if e != nil || v.PendingAmount != 0 {
		t.Fatal("late bet accepted", v, e)
	}
	// Binding errors roll back visitor, wallet and session together.
	if e = db.Exec(`CREATE FUNCTION reject_invite_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'reject invite'; END $$; CREATE TRIGGER reject_invite_test BEFORE INSERT ON lobby_invite_relations FOR EACH ROW EXECUTE FUNCTION reject_invite_test()`).Error; e != nil {
		t.Fatal(e)
	}
	if _, e = users.CreateInvited(ctx, "rollback", time.Now().Add(time.Hour), v.Code); e == nil {
		t.Fatal("binding error ignored")
	}
	db.Model(&LobbySession{}).Where("sid_hash = ?", "rollback").Count(&count)
	if count != 0 {
		t.Fatal("partial creation")
	}
	// Transactional posting failure leaves the pending reward intact for retry.
	_ = db.Exec("DROP TRIGGER reject_invite_test ON lobby_invite_relations").Error
	_ = db.Model(&LobbyActivityEvent{}).Where("event_id = ?", "late-bet").Update("occurred_at", r.Deadline.Add(-time.Second)).Error
	if e = db.Exec(`CREATE TRIGGER reject_invite_coin_test BEFORE INSERT ON lobby_coin_ledger FOR EACH ROW WHEN(NEW.source='act_007') EXECUTE FUNCTION reject_invite_test()`).Error; e != nil {
		t.Fatal(e)
	}
	if _, e = m.Claim(ctx, owner, "post-retry", r.Deadline.Add(time.Hour)); e == nil {
		t.Fatal("posting error ignored")
	}
	v, e = m.Read(ctx, owner, r.Deadline.Add(time.Hour))
	if e != nil || v.PendingAmount != 999 {
		t.Fatal("reward lost after rollback", v, e)
	}
	if e = db.Exec("DROP TRIGGER reject_invite_coin_test ON lobby_coin_ledger").Error; e != nil {
		t.Fatal(e)
	}
	b, e := m.Claim(ctx, owner, "post-retry", r.Deadline.Add(time.Hour))
	if e != nil || b.TotalReward != 999 {
		t.Fatal("same request retry did not recover", b, e)
	}
}

func TestInviteIndividualChestsAndDeadlineDetails(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	cfg := config.InviteConfig{Version: "chests", DurationDays: 30, MinDepositCount: 1, MinDepositAmount: 100, MinBetAmount: 200, RewardAmount: 300}
	m := &InviteModel{DB: db, Config: cfg}
	users := &UserModel{DB: db, Invite: m}
	owner, e := users.Create(ctx, "", "", "chest-owner", time.Now().Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	other, e := users.Create(ctx, "", "", "chest-other", time.Now().Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	v, e := m.Read(ctx, owner, time.Now())
	if e != nil {
		t.Fatal(e)
	}
	invite := func(token string) int64 {
		t.Helper()
		id, err := users.CreateInvited(ctx, token, time.Now().Add(time.Hour), v.Code)
		if err != nil {
			t.Fatal(err)
		}
		return id
	}
	first, second, late := invite("chest-first"), invite("chest-second"), invite("chest-late")
	qualify := func(id int64, at time.Time) {
		t.Helper()
		if e := (&WalletAccountModel{DB: db}).SaveAccount(ctx, id, "test1", "account", "测试"); e != nil {
			t.Fatal(e)
		}
		o := LobbyRechargeOrder{OrderID: fmt.Sprint(id), UID: id, RequestID: "deposit", TierID: "x", Amount: 100, Bonus: 900, CreditAmount: 1000, Status: "success", CreatedAt: at, SettleAt: at, SettledAt: &at}
		if err := db.Create(&o).Error; err != nil {
			t.Fatal(err)
		}
		if err := db.Create(&LobbyActivityEvent{EventID: fmt.Sprint(id), UID: id, EventType: EventGameBet, GameID: "AG1", Amount: 200, OccurredAt: at, BusinessDate: at.Format(time.DateOnly)}).Error; err != nil {
			t.Fatal(err)
		}
	}
	var relation LobbyInviteRelation
	if e = db.Where("invitee_uid=?", late).Take(&relation).Error; e != nil {
		t.Fatal(e)
	}
	// The deadline itself is excluded; later deposits and bets do not repair eligibility.
	qualify(first, relation.RegisteredAt.Add(time.Hour))
	qualify(second, relation.RegisteredAt.Add(time.Hour))
	qualify(late, relation.Deadline)
	now := relation.Deadline.Add(time.Hour)
	v, e = m.Read(ctx, owner, now)
	if e != nil || v.QualifiedCount != 2 {
		t.Fatal(v, e)
	}
	rows, e := m.Friends(ctx, owner, 1, now)
	if e != nil || len(rows) != 3 {
		t.Fatal(rows, e)
	}
	for _, r := range rows {
		if r.InviteeUID == late && (r.Qualified || r.DepositCount != 0 || r.DepositAmount != 0 || r.BetAmount != 0 || r.DurationDays != 30) {
			t.Fatal("late activity counted", r)
		}
	}
	chests, e := m.Chests(ctx, owner, 1)
	if e != nil || len(chests) != 2 || chests[0].Slot != 1 || chests[1].Slot != 2 {
		t.Fatal(chests, e)
	}
	if _, err := m.ClaimOne(ctx, other, "foreign", now, first); err == nil {
		t.Fatal("foreign claim succeeded")
	}
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			b, err := m.ClaimOne(ctx, owner, "one-chest", now, first)
			if err != nil || b.TotalReward != 300 {
				t.Errorf("individual receipt %v %v", b, err)
			}
		}()
	}
	wg.Wait()
	v, e = m.Read(ctx, owner, now)
	if e != nil || v.PendingAmount != 300 || v.ClaimedAmount != 300 {
		t.Fatal("claimed another chest", v, e)
	}
	if _, err := m.ClaimOne(ctx, owner, "one-chest", now, second); err == nil {
		t.Fatal("request reused for another chest")
	}
	if _, err := m.ClaimOne(ctx, owner, "repeat", now, first); err == nil {
		t.Fatal("claimed twice")
	}
	chests, e = m.Chests(ctx, owner, 1)
	if e != nil || chests[0].Slot != 1 || chests[1].Slot != 2 {
		t.Fatal("slots moved", chests, e)
	}
	if _, e = m.ClaimOne(ctx, owner, "second-chest", now, second); e != nil {
		t.Fatal(e)
	}
	var count int64
	db.Model(&LobbyCoinLedger{}).Where("uid=? AND source=?", owner, string(coinsource.SourceInviteReward)).Count(&count)
	if count != 2 {
		t.Fatal("wrong credit count", count)
	}
	foreign, e := m.Friends(ctx, other, 1, now)
	if e != nil || len(foreign) != 0 {
		t.Fatal("friend scope leaked", foreign, e)
	}
}
