package model

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	migrations "apps/deploy/migration"
	"apps/pkg/coinsource"
	"apps/pkg/xerr"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func TestTurnoverConfigurationAndInitialState(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	m := &TurnoverModel{DB: db}
	cfg, e := config.LoadTurnover("../../../../../../../etc/turnover.json")
	if e != nil {
		t.Fatal(e)
	}
	if e = m.Configure(ctx, cfg); e != nil {
		t.Fatal(e)
	}
	uid, e := (&UserModel{DB: db}).Create(ctx, "", "", "turnover-user", time.Now().Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	left, e := m.Remaining(ctx, uid)
	if e != nil || left != 0 {
		t.Fatal(left, e)
	}
}

func TestTurnoverCreditsWagersAndSnapshots(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	m := &TurnoverModel{DB: db}
	cfg, e := config.LoadTurnover("../../../../../../../etc/turnover.json")
	if e != nil {
		t.Fatal(e)
	}
	cfg.Multipliers["rch_002"] = 3
	cfg.Multipliers["act_002"] = 2
	if e = m.Configure(ctx, cfg); e != nil {
		t.Fatal(e)
	}
	uid, e := (&UserModel{DB: db}).Create(ctx, "", "", "turnover-example", time.Now().Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	var seq atomic.Int64
	post := func(source string, amount int64, at time.Time) error {
		return db.Transaction(func(tx *gorm.DB) error {
			var w LobbyWalletBalance
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid=?", uid).Take(&w).Error; err != nil {
				return err
			}
			id := fmt.Sprint(seq.Add(1))
			if err := tx.Create(&LobbyCoinLedger{UID: uid, OrderID: id, Source: source, Delta: amount, BalanceBefore: w.Coins, BalanceAfter: w.Coins + amount, CreatedAt: at}).Error; err != nil {
				return err
			}
			return tx.Model(&w).Update("coins", w.Coins+amount).Error
		})
	}
	check := func(want int64) {
		t.Helper()
		got, err := m.Remaining(ctx, uid)
		if err != nil || got != want {
			t.Fatalf("remaining=%d want=%d error=%v", got, want, err)
		}
	}
	now := time.Now().UTC().Add(time.Second)
	if e = post("rch_001", 100000, now.Add(-24*time.Hour)); e != nil {
		t.Fatal(e)
	}
	check(0)
	if e = post("rch_001", 100000, now); e != nil {
		t.Fatal(e)
	}
	if e = post("rch_002", 3000, now); e != nil {
		t.Fatal(e)
	}
	check(109000)
	events := &ActivityModel{DB: db, Location: time.UTC}
	valid := int64(3000)
	bet := LobbyActivityEvent{EventID: "turnover-bet", UID: uid, EventType: EventGameBet, GameID: "AG1", Amount: 6000, ValidBetAmount: &valid, OccurredAt: now}
	if e = events.RecordEvent(ctx, bet); e != nil {
		t.Fatal(e)
	}
	check(106000)
	if e = events.RecordEvent(ctx, bet); e != nil {
		t.Fatal(e)
	}
	check(106000)
	if e = post("act_002", 10000, now); e != nil {
		t.Fatal(e)
	}
	check(126000)
	cfg.Version = "v2"
	cfg.Multipliers["rch_002"] = 0
	if e = m.Configure(ctx, cfg); e != nil {
		t.Fatal(e)
	}
	check(126000)
	for _, source := range []string{"rch_002", "game_002", "wdr_002"} {
		if e = post(source, 100, now); e != nil {
			t.Fatal(e)
		}
	}
	check(126000)
	if e = post("future_unknown", 100, now); e == nil {
		t.Fatal("unconfigured source accepted")
	}
	check(126000)
	oldBet := bet
	oldBet.EventID = "historical-bet"
	oldBet.OccurredAt = now.Add(-24 * time.Hour)
	if e = events.RecordEvent(ctx, oldBet); e != nil {
		t.Fatal(e)
	}
	check(126000)
	over := bet
	over.EventID = "excess-bet"
	over.Amount = 200000
	over.ValidBetAmount = nil
	if e = events.RecordEvent(ctx, over); e != nil {
		t.Fatal(e)
	}
	check(0)
	if e = post("act_001", 100, now); e != nil {
		t.Fatal(e)
	}
	check(100)
	var snapshots []LobbyTurnoverEntry
	if e = db.Where("uid=? AND source='rch_002'", uid).Order("id").Find(&snapshots).Error; e != nil || len(snapshots) != 2 || snapshots[0].Multiplier != 3 || snapshots[0].Added != 9000 || snapshots[1].Multiplier != 0 {
		t.Fatal(snapshots, e)
	}
	var activation time.Time
	db.Raw("SELECT activated_at FROM lobby_turnover_activation WHERE id=1").Scan(&activation)
	if e = db.Exec(migrations.Schema).Error; e != nil {
		t.Fatal(e)
	}
	var restarted time.Time
	db.Raw("SELECT activated_at FROM lobby_turnover_activation WHERE id=1").Scan(&restarted)
	if !activation.Equal(restarted) {
		t.Fatal("restart changed activation time")
	}
	check(100)
	before, _ := m.Remaining(ctx, uid)
	e = db.Transaction(func(tx *gorm.DB) error {
		if e := tx.Create(&LobbyCoinLedger{UID: uid, OrderID: "rollback", Source: "act_001", Delta: 500, BalanceBefore: 0, BalanceAfter: 500, CreatedAt: now}).Error; e != nil {
			return e
		}
		return errors.New("force rollback")
	})
	if e == nil {
		t.Fatal("rollback expected")
	}
	check(before)
}

func TestTurnoverEverySourceAndConcurrentUpdates(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	m := &TurnoverModel{DB: db}
	uid, e := (&UserModel{DB: db}).Create(ctx, "", "", "turnover-all", time.Now().Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	now := time.Now().UTC().Add(time.Second)
	var expected int64
	for i, source := range config.TurnoverSources {
		if e = db.Create(&LobbyCoinLedger{UID: uid, OrderID: fmt.Sprint(i), Source: string(source), Delta: 100, BalanceBefore: 0, BalanceAfter: 100, CreatedAt: now}).Error; e != nil {
			t.Fatal(source, e)
		}
		if source != coinsource.SourceGameWin && source != coinsource.SourceWithdrawalRefund && source != coinsource.SourceExperienceFunding {
			expected += 100
		}
	}
	remaining, e := m.Remaining(ctx, uid)
	if e != nil || remaining != expected {
		t.Fatal(remaining, expected, e)
	}
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(2)
		go func(i int) {
			defer wg.Done()
			if e := db.Create(&LobbyCoinLedger{UID: uid, OrderID: fmt.Sprint("credit", i), Source: "act_001", Delta: 100, BalanceBefore: 0, BalanceAfter: 100, CreatedAt: now}).Error; e != nil {
				t.Error(e)
			}
		}(i)
		go func(i int) {
			defer wg.Done()
			if e := (&ActivityModel{DB: db, Location: time.UTC}).RecordEvent(ctx, LobbyActivityEvent{UID: uid, EventID: fmt.Sprint("bet", i), EventType: EventGameBet, GameID: "AG1", Amount: 50, OccurredAt: now}); e != nil {
				t.Error(e)
			}
		}(i)
	}
	wg.Wait()
	remaining, e = m.Remaining(ctx, uid)
	if e != nil || remaining != expected+400 {
		t.Fatal("concurrent update lost", remaining, e)
	}
}

func TestTurnoverWithdrawalGateAndRefund(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	users := &UserModel{DB: db}
	uid, e := users.Create(ctx, "", "", "withdraw-turnover", time.Now().Add(time.Hour))
	if e != nil {
		t.Fatal(e)
	}
	if e = db.Model(&LobbyWalletBalance{}).Where("uid=?", uid).Update("coins", 100000).Error; e != nil {
		t.Fatal(e)
	}
	if e = (&WalletAccountModel{DB: db}).SaveAccount(ctx, uid, "test1", "00123", "name"); e != nil {
		t.Fatal(e)
	}
	w := &WithdrawalModel{DB: db}
	tier := &config.RechargeTier{ID: "test", Amount: 5000, Bonus: 100}
	first, e := w.Create(ctx, uid, "withdraw-turnover", "first-request-0001", "test1", "test", tier)
	if e != nil {
		t.Fatal(e)
	}
	now := time.Now().UTC().Add(time.Second)
	if e = db.Create(&LobbyCoinLedger{UID: uid, OrderID: "new-credit", Source: "act_001", Delta: 100, BalanceBefore: 0, BalanceAfter: 100, CreatedAt: now}).Error; e != nil {
		t.Fatal(e)
	}
	if _, e = w.Create(ctx, uid, "withdraw-turnover", "new-request-0002", "test1", "test", tier); !errors.Is(e, xerr.ErrWithdrawalTurnover) {
		t.Fatal("gate bypassed", e)
	}
	retry, e := w.Create(ctx, uid, "withdraw-turnover", "first-request-0001", "test1", "test", tier)
	if e != nil || retry.OrderID != first.OrderID {
		t.Fatal("old receipt blocked", retry, e)
	}
	if _, e = w.Review(ctx, uid, "withdraw-turnover", first.OrderID, "return"); e != nil {
		t.Fatal(e)
	}
	left, e := w.Remaining(ctx, uid)
	if e != nil || left != 100 {
		t.Fatal("refund added turnover", left, e)
	}
	if e = (&ActivityModel{DB: db, Location: time.UTC}).RecordEvent(ctx, LobbyActivityEvent{UID: uid, EventID: "clear", EventType: EventGameBet, GameID: "AG1", Amount: 100, OccurredAt: now}); e != nil {
		t.Fatal(e)
	}
	second, e := w.Create(ctx, uid, "withdraw-turnover", "new-request-0002", "test1", "test", tier)
	if e != nil {
		t.Fatal(e)
	}
	if _, e = w.Review(ctx, uid, "withdraw-turnover", second.OrderID, "approve"); e != nil {
		t.Fatal(e)
	}
	left, e = w.Remaining(ctx, uid)
	if e != nil || left != 100 {
		t.Fatal("withdrawal bonus missing turnover", left, e)
	}
}
