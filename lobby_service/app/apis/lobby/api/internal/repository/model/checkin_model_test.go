package model

import (
	"context"
	"errors"
	"math"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"apps/app/apis/lobby/api/internal/config"
	migrations "apps/deploy/migration"
	"apps/pkg/coinsource"
	"apps/pkg/xerr"

	"github.com/jackc/pgx/v5"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestCheckinPostgres(t *testing.T) {
	url := os.Getenv("LOBBY_INTEGRATION_DATABASE_URL")
	if url == "" {
		t.Skip("set LOBBY_INTEGRATION_DATABASE_URL")
	}
	parsed, err := pgx.ParseConfig(url)
	if err != nil || parsed.Database != "aislots_lobby" {
		t.Fatal("dedicated lobby DB required")
	}
	db, err := gorm.Open(postgres.Open(url), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	defer sqlDB.Close()
	if err = db.Exec(migrations.Schema).Error; err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	token := strings.Repeat("d", 64)
	now := time.Date(2027, 1, 1, 17, 1, 0, 0, time.UTC) // Jan 2 in Jakarta.
	uid, err := (&UserModel{DB: db}).Create(ctx, "", "", token, now.AddDate(0, 1, 0))
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		for _, table := range []any{&LobbyCoinLedger{}, &LobbyCheckinClaim{}, &LobbyActivityEvent{}, &LobbyActivityDaily{}, &LobbySession{}, &LobbyWalletBalance{}, &LobbyUser{}} {
			if e := db.Where("uid = ?", uid).Delete(table).Error; e != nil {
				t.Error(e)
			}
		}
	}()
	c := config.CheckinConfig{Version: "v1", Timezone: "Asia/Jakarta", Days: []config.CheckinDay{{RequiredBet: 100, RequiredRecharge: 200, Reward: 10}, {RequiredBet: 300, RequiredRecharge: 100, Reward: 20}}}
	m := &CheckinModel{DB: db}
	activity := &ActivityModel{DB: db, Location: c.Location()}
	date := activityDate(now, c.Location())
	if date != "2027-01-02" {
		t.Fatal(date)
	}
	if _, err = m.ClaimCheckin(ctx, uid, "bad", date, c, now); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	if _, err = m.ReadCheckin(ctx, uid, "bad", c, now); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	s, err := m.ReadCheckin(ctx, uid, token, c, now)
	if err != nil || s.Day != 1 || s.Claimed {
		t.Fatal(s, err)
	}
	if _, err = m.ClaimCheckin(ctx, uid, token, date, c, now); !errors.Is(err, xerr.ErrCheckinCondition) {
		t.Fatal(err)
	}
	event := LobbyActivityEvent{EventID: "test:" + date + ":" + token + ":" + strings.Repeat("x", 10), UID: uid, EventType: EventGameBet, GameID: "AG1", Amount: 100, OccurredAt: now}
	// Unique IDs include uid so repeat integration runs never collide.
	event.EventID = event.EventID + time.Now().Format("150405.000000000")
	if err = activity.RecordEvent(ctx, event); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if e := activity.RecordEvent(ctx, event); e != nil {
				t.Error(e)
			}
		}()
	}
	wg.Wait()
	changed := event
	changed.Amount++
	if err = activity.RecordEvent(ctx, changed); !errors.Is(err, xerr.ErrActivityConflict) {
		t.Fatal(err)
	}
	if err = activity.RecordEvent(ctx, LobbyActivityEvent{}); !errors.Is(err, xerr.ErrInvalid) {
		t.Fatal(err)
	}
	// Prior day's recharge does not count toward today's condition.
	deposit := event
	deposit.EventID += "recharge_old"
	deposit.EventType = EventRechargeSuccess
	deposit.GameID = ""
	deposit.Amount = 200
	deposit.OccurredAt = now.AddDate(0, 0, -1)
	if err = activity.RecordEvent(ctx, deposit); err != nil {
		t.Fatal(err)
	}
	if _, err = m.ClaimCheckin(ctx, uid, token, date, c, now); !errors.Is(err, xerr.ErrCheckinCondition) {
		t.Fatal(err)
	}
	deposit.EventID += "today"
	deposit.OccurredAt = now
	if err = activity.RecordEvent(ctx, deposit); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			claim, e := m.ClaimCheckin(ctx, uid, token, date, c, now)
			if e != nil || claim.Reward != 10 || claim.Day != 1 {
				t.Error(claim, e)
			}
		}()
	}
	wg.Wait()
	s, err = m.ReadCheckin(ctx, uid, token, c, now)
	if err != nil || !s.Claimed || s.Daily.ValidBet != 100 || s.Daily.RechargeAmount != 200 {
		t.Fatal(s, err)
	}
	var wallet LobbyWalletBalance
	db.Where("uid = ?", uid).Take(&wallet)
	if wallet.Coins != 10 {
		t.Fatal("duplicate credit", wallet)
	}
	var ledger []LobbyCoinLedger
	db.Where("uid = ?", uid).Find(&ledger)
	if len(ledger) != 1 || ledger[0].Source != string(coinsource.SourceCheckinReward) {
		t.Fatal(ledger)
	}
	tomorrow := now.AddDate(0, 0, 1)
	s, err = m.ReadCheckin(ctx, uid, token, c, tomorrow)
	if err != nil || s.Day != 2 || s.Daily.ValidBet != 0 || s.Daily.RechargeAmount != 0 {
		t.Fatal(s, err)
	}
	// Missing the second day resets to day1, even though the cycle was not complete.
	missed, e := m.ReadCheckin(ctx, uid, token, c, now.AddDate(0, 0, 2))
	if e != nil || missed.Day != 1 {
		t.Fatal(missed, e)
	}
	changedConfig := c
	changedConfig.Version = "next"
	reset, e := m.ReadCheckin(ctx, uid, token, changedConfig, tomorrow)
	if e != nil || reset.Day != 1 {
		t.Fatal("new config did not reset progression", reset, e)
	}
	// A delayed retry returns yesterday's receipt and cannot claim a new day.
	replay, err := m.ClaimCheckin(ctx, uid, token, date, c, tomorrow)
	if err != nil || replay.Coins != 10 {
		t.Fatal(replay, err)
	}
	if _, err = m.ClaimCheckin(ctx, uid, token, activityDate(now.AddDate(0, 0, -1), c.Location()), c, tomorrow); !errors.Is(err, xerr.ErrCheckinDate) {
		t.Fatal(err)
	}
	for _, e := range []LobbyActivityEvent{
		{EventID: event.EventID + "bet2", UID: uid, EventType: EventGameBet, GameID: "AG2", Amount: 300, OccurredAt: tomorrow},
		{EventID: event.EventID + "dep2", UID: uid, EventType: EventRechargeSuccess, Amount: 100, OccurredAt: tomorrow},
	} {
		if err = activity.RecordEvent(ctx, e); err != nil {
			t.Fatal(err)
		}
	}
	claim, err := m.ClaimCheckin(ctx, uid, token, activityDate(tomorrow, c.Location()), c, tomorrow)
	if err != nil || claim.Day != 2 || claim.Coins != 30 {
		t.Fatal(claim, err)
	}
	s, err = m.ReadCheckin(ctx, uid, token, c, now.AddDate(0, 0, 2))
	if err != nil || s.Day != 1 {
		t.Fatal("cycle failed", s, err)
	}
	s, err = m.ReadCheckin(ctx, uid, token, c, now.AddDate(0, 0, 3))
	if err != nil || s.Day != 1 {
		t.Fatal("missed day did not reset", s, err)
	}
	c.Version = "v2"
	s, err = m.ReadCheckin(ctx, uid, token, c, tomorrow)
	if err != nil || !s.Claimed || s.Rule.Reward != 20 {
		t.Fatal("existing receipt changed", s, err)
	}
	// New config starts at day1 on the next unclaimed day.
	c.Version = "v2"
	s, err = m.ReadCheckin(ctx, uid, token, c, now.AddDate(0, 0, 2))
	if err != nil || s.Day != 1 {
		t.Fatal(s, err)
	}
	// Overflow rolls back both the claim and the ledger.
	c.Days = []config.CheckinDay{{Reward: 1}}
	db.Model(&LobbyWalletBalance{}).Where("uid = ?", uid).Update("coins", int64(math.MaxInt64))
	future := now.AddDate(0, 0, 4)
	if _, err = m.ClaimCheckin(ctx, uid, token, activityDate(future, c.Location()), c, future); !errors.Is(err, xerr.ErrBalanceLimit) {
		t.Fatal(err)
	}
	var count int64
	db.Model(&LobbyCheckinClaim{}).Where("uid = ?", uid).Count(&count)
	if count != 2 {
		t.Fatal("failed claim persisted", count)
	}
}
