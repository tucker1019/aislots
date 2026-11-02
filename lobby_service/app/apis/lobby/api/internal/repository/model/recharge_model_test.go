package model

import (
	"context"
	"errors"
	"math"
	"os"
	"reflect"
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

func TestRechargePostgresTransactions(t *testing.T) {
	url := os.Getenv("LOBBY_INTEGRATION_DATABASE_URL")
	if url == "" {
		t.Skip("set LOBBY_INTEGRATION_DATABASE_URL to run PostgreSQL integration tests")
	}
	cfg, err := pgx.ParseConfig(url)
	if err != nil || cfg.Database != "aislots_lobby" {
		t.Fatal("dedicated lobby database required")
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
	token := strings.Repeat("b", 64)
	uid, err := (&UserModel{DB: db}).Create(ctx, "", "", token, time.Now().Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	defer func() {
		db.Where("uid = ?", uid).Delete(&LobbyActivityDaily{})
		db.Where("uid = ?", uid).Delete(&LobbyActivityEvent{})
		db.Where("uid = ?", uid).Delete(&LobbyCoinLedger{})
		db.Where("uid = ?", uid).Delete(&LobbyRechargeOrder{})
		db.Where("uid = ?", uid).Delete(&LobbySession{})
		db.Where("uid = ?", uid).Delete(&LobbyWalletBalance{})
		db.Where("uid = ?", uid).Delete(&LobbyUser{})
	}()
	m := &RechargeModel{DB: db}
	now := time.Now().UTC()
	fee := &config.RechargeTier{ID: "fee", Amount: 10000, Fee: 200}
	first, err := m.CreateRecharge(ctx, uid, token, "fee_once", "fee", fee, time.Now())
	if err != nil || first.Status != "pending" || first.Coins != 0 {
		t.Fatal(first, err)
	}
	replay, err := m.CreateRecharge(ctx, uid, token, "fee_once", "fee", nil, time.Now())
	if err != nil || !reflect.DeepEqual(replay, first) {
		t.Fatal(replay, err)
	}
	if _, err = m.CreateRecharge(ctx, uid, token, "fee_once", "other", nil, time.Now()); !errors.Is(err, xerr.ErrRequestConflict) {
		t.Fatal(err)
	}
	bonus := &config.RechargeTier{ID: "bonus", Amount: 10000, Bonus: 1000}
	second, err := m.CreateRecharge(ctx, uid, token, "bonus_once", "bonus", bonus, time.Now())
	if err != nil || second.Status != "pending" {
		t.Fatal(second, err)
	}
	var wg sync.WaitGroup
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, e := m.CreateRecharge(ctx, uid, token, "parallel", "bonus", bonus, time.Now())
			if e != nil {
				t.Error(e)
			}
		}()
	}
	wg.Wait()
	var before LobbyWalletBalance
	db.Where("uid = ?", uid).Take(&before)
	if before.Coins != 0 {
		t.Fatal("credited before payment", before)
	}
	if err = m.SettleDue(ctx, now.Add(time.Second)); err != nil {
		t.Fatal(err)
	}
	db.Where("uid = ?", uid).Take(&before)
	if before.Coins != 0 {
		t.Fatal("settled too early")
	}
	// A fresh instance must recover persisted orders without the creating process.
	worker := &RechargeModel{DB: db}
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if e := worker.SettleDue(ctx, now.Add(4*time.Second)); e != nil {
				t.Error(e)
			}
		}()
	}
	wg.Wait()
	var wallet LobbyWalletBalance
	if err = db.Where("uid = ?", uid).Take(&wallet).Error; err != nil || wallet.Coins != 31800 {
		t.Fatal(wallet, err)
	}
	var totals LobbyActivityDaily
	db.Model(&LobbyActivityDaily{}).Select("uid, sum(recharge_amount) AS recharge_amount").Where("uid = ?", uid).Group("uid").Take(&totals)
	if totals.RechargeAmount != 30000 {
		t.Fatal("recharge principal should count once", totals)
	}
	var entries []LobbyCoinLedger
	db.Where("uid = ?", uid).Order("id").Find(&entries)
	if len(entries) != 6 || entries[0].Source != string(coinsource.SourceRechargeCredit) || entries[1].Source != string(coinsource.SourceRechargeFee) || entries[1].Delta != -200 || entries[3].Source != string(coinsource.SourceRechargeBonus) {
		t.Fatal(entries)
	}
	if _, err = m.CreateRecharge(ctx, uid, "invalid", "bad_session", "fee", fee, time.Now()); !errors.Is(err, xerr.ErrSession) {
		t.Fatal(err)
	}
	db.Model(&LobbyWalletBalance{}).Where("uid = ?", uid).Update("coins", int64(math.MaxInt64-10))
	overflow, e := m.CreateRecharge(ctx, uid, token, "overflow", "fee", fee, now)
	if e != nil {
		t.Fatal(e)
	}
	if e = m.SettleDue(ctx, now.Add(5*time.Second)); e != nil {
		t.Fatal(e)
	}
	failed, e := m.ReadRechargeOrder(ctx, uid, token, overflow.OrderID, now)
	if e != nil || failed.Status != "failed" || failed.FailureCode != 10010009 {
		t.Fatal(failed, e)
	}
	if _, e = m.ReadRechargeOrder(ctx, uid, token, "missing", now); !errors.Is(e, xerr.ErrOrderNotFound) {
		t.Fatal(e)
	}
	if _, e = m.ReadRechargeOrder(ctx, uid, "invalid", first.OrderID, now); !errors.Is(e, xerr.ErrSession) {
		t.Fatal(e)
	}
	page, e := m.ReadRechargeOrders(ctx, uid, token, OrderQuery{Status: "success", Limit: 1}, now)
	if e != nil || len(page) != 2 {
		t.Fatal(page, e)
	}
	next, e := m.ReadRechargeOrders(ctx, uid, token, OrderQuery{Status: "success", Limit: 1, BeforeTime: page[0].CreatedAt, BeforeID: page[0].OrderID}, now)
	if e != nil || len(next) != 2 || next[0].OrderID == page[0].OrderID {
		t.Fatal(next, e)
	}
	var ledgerCount int64
	db.Model(&LobbyCoinLedger{}).Where("uid = ?", uid).Count(&ledgerCount)
	if ledgerCount != 6 {
		t.Fatal("duplicate/failed credit", ledgerCount)
	}
	var count int64
	db.Model(&LobbyRechargeOrder{}).Where("uid = ?", uid).Count(&count)
	if count != 4 {
		t.Fatal("failed or repeated request created order", count)
	}
}
