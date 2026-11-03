package model

import (
	"context"
	"errors"
	"math"
	"time"

	"apps/pkg/coinsource"
	"apps/pkg/xerr"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type GameModel struct {
	DB       *gorm.DB
	Location *time.Location
	VIP      *VIPModel
}

func (m *GameModel) Issue(ctx context.Context, uid int64, sid, hash, game string, expires time.Time) error {
	return m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if e := (&UserModel{DB: tx}).Check(ctx, uid, sid, time.Now().UTC()); e != nil {
			return e
		}
		return tx.Create(&LobbyGameTicket{TokenHash: hash, UID: uid, GameID: game, ExpiresAt: expires}).Error
	})
}

func (m *GameModel) Exchange(ctx context.Context, hash, id, game string, now time.Time) (int64, error) {
	var ticket LobbyGameTicket
	e := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if e := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("token_hash = ? AND game_id = ?", hash, game).Take(&ticket).Error; e != nil {
			if errors.Is(e, gorm.ErrRecordNotFound) {
				return xerr.ErrGameTicket
			}
			return e
		}
		if ticket.ExchangeID != "" {
			if ticket.ExchangeID != id || ticket.ExchangedAt == nil || now.After(ticket.ExchangedAt.Add(24*time.Hour)) {
				return xerr.ErrGameTicket
			}
			return nil
		}
		if !now.Before(ticket.ExpiresAt) {
			return xerr.ErrGameTicket
		}
		return tx.Model(&ticket).Updates(map[string]any{"exchange_id": id, "exchanged_at": now}).Error
	})
	return ticket.UID, e
}

func (m *GameModel) Balance(ctx context.Context, uid int64) (int64, error) {
	var w LobbyWalletBalance
	e := m.DB.WithContext(ctx).Where("uid = ?", uid).Take(&w).Error
	return w.Coins, e
}

// Both the paid wager and this frame's award are posted atomically. A rejected debit never pays its credit.
func (m *GameModel) Settle(ctx context.Context, in *LobbyGameSettlement, now time.Time) (*LobbyGameSettlement, error) {
	if in == nil || in.UID <= 0 || in.RequestID == "" || len(in.RequestID) > 128 || in.GameID == "" || in.BetID == "" || in.Debit < 0 || in.Credit < 0 || in.Debit == 0 && in.Credit == 0 {
		return nil, xerr.ErrInvalid
	}
	out := *in
	e := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var w LobbyWalletBalance
		if e := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid = ?", in.UID).Take(&w).Error; e != nil {
			return e
		}
		var old LobbyGameSettlement
		e := tx.Where("request_id = ?", in.RequestID).Take(&old).Error
		if e == nil {
			if old.UID != in.UID || old.GameID != in.GameID || old.BetID != in.BetID || old.Debit != in.Debit || old.Credit != in.Credit {
				return xerr.ErrGameConflict
			}
			out = old
			return nil
		}
		if !errors.Is(e, gorm.ErrRecordNotFound) {
			return e
		}
		out.Coins = w.Coins
		out.CreatedAt = now
		out.Status = "rejected"
		if w.Coins < in.Debit {
			return tx.Create(&out).Error
		}
		if w.Coins-in.Debit > math.MaxInt64-in.Credit {
			return xerr.ErrBalanceLimit
		}
		if in.Debit > 0 {
			var n int64
			if e := tx.Model(&LobbyGameSettlement{}).Where("bet_id = ? AND debit > 0 AND status = ?", in.BetID, "confirmed").Count(&n).Error; e != nil {
				return e
			}
			if n > 0 {
				return xerr.ErrGameConflict
			}
		}
		post := func(s coinsource.Source, delta int64, event string) error {
			if delta == 0 {
				return nil
			}
			before := w.Coins
			w.Coins += delta
			if e := tx.Create(&LobbyCoinLedger{UID: in.UID, OrderID: in.RequestID, Source: string(s), Delta: delta, BalanceBefore: before, BalanceAfter: w.Coins, CreatedAt: now}).Error; e != nil {
				return e
			}
			amount := delta
			if amount < 0 {
				amount = -amount
			}
			return recordActivity(tx, &LobbyActivityEvent{EventID: "game:" + in.RequestID + ":" + event, UID: in.UID, EventType: event, GameID: in.GameID, Amount: amount, OccurredAt: now.UTC().Truncate(time.Microsecond), BusinessDate: activityDate(now, m.Location)}, m.VIP)
		}
		if e := post(coinsource.SourceGameBet, -in.Debit, EventGameBet); e != nil {
			return e
		}
		if e := post(coinsource.SourceGameWin, in.Credit, EventGameWin); e != nil {
			return e
		}
		out.Coins = w.Coins
		out.Status = "confirmed"
		if e := tx.Model(&w).Update("coins", w.Coins).Error; e != nil {
			return e
		}
		return tx.Create(&out).Error
	})
	return &out, e
}
