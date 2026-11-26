package model

import (
	"context"
	"errors"
	"math"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var (
	ErrThirdPartyUserNotFound      = errors.New("user not found")
	ErrThirdPartyInsufficientFunds = errors.New("insufficient balance")
	ErrThirdPartyInvalidAmount     = errors.New("invalid amount")
	ErrThirdPartyConflict          = errors.New("transaction conflict")
)

type LobbyThirdPartyTransaction struct {
	ID             int64      `gorm:"column:id;primaryKey;autoIncrement"`
	Provider       string     `gorm:"column:provider"`
	TransactionID  string     `gorm:"column:transaction_id"`
	RoundID        string     `gorm:"column:round_id"`
	BetID          string     `gorm:"column:bet_id"`
	UID            int64      `gorm:"column:uid"`
	GameID         string     `gorm:"column:game_id"`
	ExternalGameID string     `gorm:"column:external_game_id"`
	Reason         string     `gorm:"column:reason"`
	AmountMinor    int64      `gorm:"column:amount_minor"`
	BalanceBefore  int64      `gorm:"column:balance_before"`
	BalanceAfter   int64      `gorm:"column:balance_after"`
	Status         string     `gorm:"column:status"`
	CreatedAt      time.Time  `gorm:"column:created_at"`
	RolledBackAt   *time.Time `gorm:"column:rolled_back_at"`
}

func (LobbyThirdPartyTransaction) TableName() string { return "lobby_thirdparty_transactions" }

type ThirdPartyModel struct {
	DB       *gorm.DB
	Location *time.Location
	VIP      *VIPModel
}

func (m *ThirdPartyModel) Balance(ctx context.Context, uid int64) (int64, error) {
	var w LobbyWalletBalance
	err := m.DB.WithContext(ctx).Where("uid = ?", uid).Take(&w).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return 0, ErrThirdPartyUserNotFound
	}
	return w.Coins, err
}

type ThirdPartyTransferInput struct {
	Provider       string
	TransactionID  string
	RoundID        string
	BetID          string
	UID            int64
	GameID         string
	ExternalGameID string
	Reason         string // "bet" or "win"
	AmountMinor    int64  // negative for bet, positive for win
}

func (m *ThirdPartyModel) TransferInOut(ctx context.Context, in ThirdPartyTransferInput, now time.Time) (int64, error) {
	if in.Provider == "" || in.TransactionID == "" || in.UID <= 0 || in.AmountMinor == 0 {
		return 0, ErrThirdPartyInvalidAmount
	}
	if in.Reason == "bet" && in.AmountMinor >= 0 {
		return 0, ErrThirdPartyInvalidAmount
	}
	if in.Reason == "win" && in.AmountMinor <= 0 {
		return 0, ErrThirdPartyInvalidAmount
	}
	if in.Reason != "bet" && in.Reason != "win" {
		return 0, ErrThirdPartyInvalidAmount
	}

	var balance int64
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var w LobbyWalletBalance
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid = ?", in.UID).Take(&w).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrThirdPartyUserNotFound
			}
			return err
		}

		var existing LobbyThirdPartyTransaction
		err := tx.Where("provider = ? AND transaction_id = ?", in.Provider, in.TransactionID).Take(&existing).Error
		if err == nil {
			if existing.UID != in.UID || existing.Reason != in.Reason || existing.AmountMinor != in.AmountMinor {
				return ErrThirdPartyConflict
			}
			balance = existing.BalanceAfter
			return nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		before := w.Coins
		if in.AmountMinor < 0 {
			debit := -in.AmountMinor
			if w.Coins < debit {
				return ErrThirdPartyInsufficientFunds
			}
			w.Coins -= debit
		} else {
			if w.Coins > math.MaxInt64-in.AmountMinor {
				return ErrThirdPartyInvalidAmount
			}
			w.Coins += in.AmountMinor
		}

		source := "game_bet:" + in.GameID
		eventType := EventGameBet
		absAmount := -in.AmountMinor
		if in.Reason == "win" {
			source = "game_win:" + in.GameID
			eventType = EventGameWin
			absAmount = in.AmountMinor
		}

		orderID := in.Provider + ":" + in.TransactionID
		if err := tx.Create(&LobbyCoinLedger{
			UID:           in.UID,
			OrderID:       orderID,
			Source:        source,
			Delta:         in.AmountMinor,
			BalanceBefore: before,
			BalanceAfter:  w.Coins,
			CreatedAt:     now,
		}).Error; err != nil {
			return err
		}

		if err := recordActivity(tx, &LobbyActivityEvent{
			EventID:      "tp:" + in.Provider + ":" + in.TransactionID + ":" + eventType,
			UID:          in.UID,
			EventType:    eventType,
			GameID:       in.GameID,
			Amount:       absAmount,
			OccurredAt:   now.UTC().Truncate(time.Microsecond),
			BusinessDate: activityDate(now, m.Location),
		}, m.VIP); err != nil {
			return err
		}

		if err := tx.Model(&w).Update("coins", w.Coins).Error; err != nil {
			return err
		}

		row := LobbyThirdPartyTransaction{
			Provider:       in.Provider,
			TransactionID:  in.TransactionID,
			RoundID:        in.RoundID,
			BetID:          in.BetID,
			UID:            in.UID,
			GameID:         in.GameID,
			ExternalGameID: in.ExternalGameID,
			Reason:         in.Reason,
			AmountMinor:    in.AmountMinor,
			BalanceBefore:  before,
			BalanceAfter:   w.Coins,
			Status:         "confirmed",
			CreatedAt:      now,
		}
		if err := tx.Create(&row).Error; err != nil {
			return err
		}
		if err := m.recordStatisticsTx(tx, in, now); err != nil {
			return err
		}
		balance = w.Coins
		return nil
	})
	return balance, err
}

func (m *ThirdPartyModel) recordStatisticsTx(tx *gorm.DB, in ThirdPartyTransferInput, now time.Time) error {
	betID := in.Provider + ":" + in.RoundID
	if in.RoundID == "" {
		betID = in.Provider + ":" + in.TransactionID
	}
	if err := tx.Exec("SELECT pg_advisory_xact_lock(hashtextextended(?,20261103))", in.GameID).Error; err != nil {
		return err
	}
	var betDelta, winDelta int64
	if in.Reason == "bet" {
		betDelta = -in.AmountMinor
	} else {
		winDelta = in.AmountMinor
	}
	var existing struct {
		BetAmount int64
		WinAmount int64
		StartedAt time.Time
		Included  bool
	}
	q := tx.Table("lobby_game_completions").Select("bet_amount,win_amount,started_at,included").Where("game_id=? AND bet_id=?", in.GameID, betID).Limit(1).Find(&existing)
	if q.Error != nil {
		return q.Error
	}
	var privacy struct {
		Participating bool
		Anonymous     bool
		Nickname      string
		AccountType   string
	}
	if err := tx.Table("lobby_users").Select("leaderboard_participating AS participating,leaderboard_anonymous AS anonymous,nickname,account_type").Where("uid=?", in.UID).Take(&privacy).Error; err != nil {
		return err
	}

	var totalBet, totalWin int64
	startedAt := now.UTC()
	isNewRound := q.RowsAffected == 0
	if isNewRound {
		var lastSeq int64
		if err := tx.Raw("SELECT COALESCE(MAX(sequence),0) FROM lobby_game_completions WHERE game_id=? AND uid=?", in.GameID, in.UID).Scan(&lastSeq).Error; err != nil {
			return err
		}
		totalBet = betDelta
		totalWin = winDelta
		if err := tx.Exec(
			`INSERT INTO lobby_game_completions(game_id,bet_id,uid,sequence,bet_amount,win_amount,started_at,ended_at,included,leaderboard_participating,leaderboard_anonymous,leaderboard_nickname) VALUES(?,?,?,?,?,?,?,?,true,?,?,?)`,
			in.GameID, betID, in.UID, lastSeq+1, totalBet, totalWin, startedAt, now.UTC(), privacy.Participating, privacy.Anonymous, privacy.Nickname,
		).Error; err != nil {
			return err
		}
	} else {
		totalBet = existing.BetAmount + betDelta
		totalWin = existing.WinAmount + winDelta
		startedAt = existing.StartedAt
		if err := tx.Exec(
			`UPDATE lobby_game_completions SET bet_amount=?,win_amount=?,ended_at=? WHERE game_id=? AND bet_id=?`,
			totalBet, totalWin, now.UTC(), in.GameID, betID,
		).Error; err != nil {
			return err
		}
	}

	if privacy.AccountType != "experience" {
		roundsDelta := int64(0)
		if isNewRound {
			roundsDelta = 1
		}
		if err := tx.Exec(
			`INSERT INTO lobby_game_rtp_minutes(game_id,minute,bet_amount,win_amount,rounds) VALUES(?,?,?,?,?) ON CONFLICT(game_id,minute) DO UPDATE SET bet_amount=lobby_game_rtp_minutes.bet_amount+EXCLUDED.bet_amount,win_amount=lobby_game_rtp_minutes.win_amount+EXCLUDED.win_amount,rounds=lobby_game_rtp_minutes.rounds+EXCLUDED.rounds`,
			in.GameID, startedAt.UTC().Truncate(time.Minute), betDelta, winDelta, roundsDelta,
		).Error; err != nil {
			return err
		}
	}

	if totalWin > 0 && totalBet > 0 {
		loc := m.Location
		if loc == nil {
			loc = time.UTC
		}
		comp := GameCompletion{
			UID:       in.UID,
			GameID:    in.GameID,
			BetID:     betID,
			BetAmount: totalBet,
			WinAmount: totalWin,
			StartedAt: startedAt,
			EndedAt:   now.UTC(),
		}
		day := startedAt.In(loc).Format(time.DateOnly)
		for _, period := range []string{"day:" + day, "all"} {
			for _, board := range []string{"wins", "multiplier"} {
				if err := saveCandidate(tx, comp, period, board, comp.BetID); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

func (m *ThirdPartyModel) Rollback(ctx context.Context, provider, transactionID string, uid int64, now time.Time) (int64, error) {
	var balance int64
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var w LobbyWalletBalance
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("uid = ?", uid).Take(&w).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrThirdPartyUserNotFound
			}
			return err
		}

		var orig LobbyThirdPartyTransaction
		err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("provider = ? AND transaction_id = ?", provider, transactionID).Take(&orig).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Per spec: if original bet does not exist, idempotently return current balance.
			balance = w.Coins
			return nil
		}
		if err != nil {
			return err
		}
		if orig.UID != uid {
			return ErrThirdPartyConflict
		}
		if orig.Status == "rolled_back" || orig.Reason != "bet" {
			balance = w.Coins
			return nil
		}

		refund := -orig.AmountMinor
		if refund <= 0 || w.Coins > math.MaxInt64-refund {
			return ErrThirdPartyInvalidAmount
		}
		before := w.Coins
		w.Coins += refund

		orderID := provider + ":rb:" + transactionID
		if err := tx.Create(&LobbyCoinLedger{
			UID:           uid,
			OrderID:       orderID,
			Source:        "game_rb:" + orig.GameID,
			Delta:         refund,
			BalanceBefore: before,
			BalanceAfter:  w.Coins,
			CreatedAt:     now,
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&w).Update("coins", w.Coins).Error; err != nil {
			return err
		}
		if err := tx.Model(&orig).Updates(map[string]any{
			"status":         "rolled_back",
			"rolled_back_at": now,
		}).Error; err != nil {
			return err
		}
		balance = w.Coins
		return nil
	})
	return balance, err
}
