package model

import (
	"context"
	"errors"
	"testing"
	"time"

	"apps/pkg/coinsource"
	"apps/pkg/xerr"
)

func TestRedeemCodeAssignsAtomicCreditAndSupportsSingleUseRetries(t *testing.T) {
	db := vipTestDB(t)
	ctx := context.Background()
	now := time.Now().UTC()
	uid, err := (&UserModel{DB: db}).Create(ctx, "", "", "redeem-token", now.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	other, err := (&UserModel{DB: db}).Create(ctx, "", "", "other-redeem-token", now.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	codes := &RedeemCodeModel{DB: db}
	code, row, err := codes.Create(ctx, uid, 2500, true, "admin", "customer compensation")
	if err != nil {
		t.Fatal(err)
	}
	if len(code) < 20 || row.CodeHash == code {
		t.Fatal("generated code must be high-entropy and stored as a hash")
	}
	if _, err = codes.Redeem(ctx, other, "other-redeem-token", code, now); !errors.Is(err, xerr.ErrRedeemCode) {
		t.Fatalf("wrong owner: %v", err)
	}
	receipt, err := codes.Redeem(ctx, uid, "redeem-token", code, now)
	if err != nil || receipt.Amount != 2500 || receipt.Coins != 2500 {
		t.Fatal(receipt, err)
	}
	retried, err := codes.Redeem(ctx, uid, "redeem-token", code, now.Add(time.Minute))
	if err != nil || *retried != *receipt {
		t.Fatal(retried, err)
	}
	var count int64
	if err = db.Model(&LobbyCoinLedger{}).Where("uid=? AND source=?", uid, string(coinsource.SourceRedeemCodeReward)).Count(&count).Error; err != nil || count != 1 {
		t.Fatal(count, err)
	}
	var turnover LobbyTurnoverEntry
	if err = db.Where("uid=? AND credit_ledger_id IN (SELECT id FROM lobby_coin_ledger WHERE order_id=?)", uid, row.ID).Take(&turnover).Error; err != nil || turnover.Added != 2500 || turnover.Multiplier != 1 {
		t.Fatal(turnover, err)
	}
	noTurnover, _, err := codes.Create(ctx, uid, 300, false, "admin", "courtesy credit")
	if err != nil {
		t.Fatal(err)
	}
	if _, err = codes.Redeem(ctx, uid, "redeem-token", noTurnover, now); err != nil {
		t.Fatal(err)
	}
	if err = db.Model(&LobbyTurnoverEntry{}).Where("uid=? AND source=? AND amount=300 AND multiplier=0", uid, string(coinsource.SourceRedeemCodeReward)).Count(&count).Error; err != nil || count != 1 {
		t.Fatal(count, err)
	}
}
