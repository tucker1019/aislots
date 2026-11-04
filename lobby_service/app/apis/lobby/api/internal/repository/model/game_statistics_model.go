package model

import (
	"context"
	"strconv"
	"time"

	"apps/pkg/xerr"

	"gorm.io/gorm"
)

type GameCompletion struct {
	PlatformOrderID                int64
	UID                            int64
	GameID, BetID                  string
	Sequence, BetAmount, WinAmount int64
	StartedAt, EndedAt             time.Time
}
type RTPView struct {
	From, To, Since               time.Time
	BetAmount, WinAmount, Percent string
	Rounds                        int64
	HasData                       bool
}
type RankView struct {
	UID                                     int64
	BetID, BetAmount, WinAmount, Multiplier string
	PlatformOrderID                         string
	Streak                                  int64
	EndedAt                                 time.Time
	Nickname                                string
	AvatarID                                int32
	ExperienceAccount                       bool
}

func (m *GameModel) CompleteGame(ctx context.Context, in GameCompletion) (bool, error) {
	included := false
	err := m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// Each game's small candidate sets and aggregate updates share one short transaction lock.
		if e := tx.Exec("SELECT pg_advisory_xact_lock(hashtextextended(?,20261103))", in.GameID).Error; e != nil {
			return e
		}
		var old struct {
			UID, Sequence, BetAmount, WinAmount int64
			StartedAt, EndedAt                  time.Time
			Included                            bool
		}
		q := tx.Table("lobby_game_completions").Where("game_id=? AND bet_id=?", in.GameID, in.BetID).Limit(1).Find(&old)
		if q.Error != nil {
			return q.Error
		}
		if q.RowsAffected > 0 {
			if old.UID != in.UID || old.Sequence != in.Sequence || old.BetAmount != in.BetAmount || old.WinAmount != in.WinAmount || !old.StartedAt.Equal(in.StartedAt) || !old.EndedAt.Equal(in.EndedAt) {
				return xerr.ErrGameConflict
			}
			included = old.Included
			return nil
		}
		var funds struct {
			Debit, Credit string
			Started       time.Time
		}
		if e := tx.Model(&LobbyGameSettlement{}).Select("COALESCE(SUM(debit),0)::text AS debit,COALESCE(SUM(credit),0)::text AS credit,MIN(created_at) AS started").Where("uid=? AND game_id=? AND bet_id=? AND status='confirmed'", in.UID, in.GameID, in.BetID).Scan(&funds).Error; e != nil {
			return e
		}
		if funds.Debit != strconv.FormatInt(in.BetAmount, 10) || funds.Credit != strconv.FormatInt(in.WinAmount, 10) {
			return xerr.ErrGameConflict
		}
		var epoch time.Time
		if e := tx.Raw("SELECT started_at FROM lobby_game_statistics_epoch WHERE id=1").Scan(&epoch).Error; e != nil {
			return e
		}
		included = !in.StartedAt.Before(epoch) && !funds.Started.Before(epoch)
		if e := tx.Exec("INSERT INTO lobby_game_streaks(game_id,uid) VALUES(?,?) ON CONFLICT DO NOTHING", in.GameID, in.UID).Error; e != nil {
			return e
		}
		var state struct{ LastSequence, CurrentStreak, RunID int64 }
		if e := tx.Table("lobby_game_streaks").Where("game_id=? AND uid=?", in.GameID, in.UID).Take(&state).Error; e != nil {
			return e
		}
		if in.Sequence != state.LastSequence+1 {
			return xerr.ErrGameConflict
		}
		query := `INSERT INTO lobby_game_completions(game_id,bet_id,uid,sequence,bet_amount,win_amount,started_at,ended_at,included) VALUES(?,?,?,?,?,?,?,?,?)`
		args := []any{in.GameID, in.BetID, in.UID, in.Sequence, in.BetAmount, in.WinAmount, in.StartedAt, in.EndedAt, included}
		if in.PlatformOrderID > 0 {
			query = `INSERT INTO lobby_game_completions(game_id,bet_id,uid,sequence,bet_amount,win_amount,started_at,ended_at,included,platform_order_id) OVERRIDING SYSTEM VALUE VALUES(?,?,?,?,?,?,?,?,?,?)`
			args = append(args, in.PlatformOrderID)
		}
		if e := tx.Exec(query, args...).Error; e != nil {
			return e
		}
		if !included || in.WinAmount == 0 {
			state.CurrentStreak = 0
			state.RunID = in.Sequence
		} else {
			state.CurrentStreak++
		}
		if e := tx.Exec("UPDATE lobby_game_streaks SET last_sequence=?,current_streak=?,run_id=? WHERE game_id=? AND uid=?", in.Sequence, state.CurrentStreak, state.RunID, in.GameID, in.UID).Error; e != nil {
			return e
		}
		if !included {
			return nil
		}
		var accountType string
		if e := tx.Table("lobby_users").Select("account_type").Where("uid=?", in.UID).Scan(&accountType).Error; e != nil {
			return e
		}
		if accountType != "experience" {
			if e := tx.Exec(`INSERT INTO lobby_game_rtp_minutes(game_id,minute,bet_amount,win_amount,rounds) VALUES(?,?,?,?,1) ON CONFLICT(game_id,minute) DO UPDATE SET bet_amount=lobby_game_rtp_minutes.bet_amount+EXCLUDED.bet_amount,win_amount=lobby_game_rtp_minutes.win_amount+EXCLUDED.win_amount,rounds=lobby_game_rtp_minutes.rounds+1`, in.GameID, in.StartedAt.UTC().Truncate(time.Minute), in.BetAmount, in.WinAmount).Error; e != nil {
				return e
			}
		}
		day := in.StartedAt.In(m.Location).Format(time.DateOnly)
		for _, period := range []string{"day:" + day, "all"} {
			if in.WinAmount > 0 {
				for _, board := range []string{"wins", "multiplier"} {
					if e := saveCandidate(tx, in, period, board, in.BetID, 0); e != nil {
						return e
					}
				}
			}
		}
		if state.CurrentStreak == 0 {
			return nil
		}
		if e := tx.Exec(`INSERT INTO lobby_game_streak_days(game_id,uid,run_id,day,wins) VALUES(?,?,?,?,1) ON CONFLICT(game_id,uid,run_id,day) DO UPDATE SET wins=lobby_game_streak_days.wins+1`, in.GameID, in.UID, state.RunID, day).Error; e != nil {
			return e
		}
		uidKey := strconv.FormatInt(in.UID, 10)
		if e := saveCandidate(tx, in, "all", "streak", uidKey, state.CurrentStreak); e != nil {
			return e
		}
		var dayWins int64
		if e := tx.Raw("SELECT wins FROM lobby_game_streak_days WHERE game_id=? AND uid=? AND run_id=? AND day=?", in.GameID, in.UID, state.RunID, day).Scan(&dayWins).Error; e != nil {
			return e
		}
		if e := saveCandidate(tx, in, "day:"+day, "streak", uidKey, dayWins); e != nil {
			return e
		}
		date, _ := time.ParseInLocation(time.DateOnly, day, m.Location)
		for offset := 0; offset < 7; offset++ {
			end := date.AddDate(0, 0, offset)
			start := end.AddDate(0, 0, -6)
			var wins int64
			if e := tx.Raw("SELECT COALESCE(SUM(wins),0) FROM lobby_game_streak_days WHERE game_id=? AND uid=? AND run_id=? AND day>=? AND day<=?", in.GameID, in.UID, state.RunID, start.Format(time.DateOnly), end.Format(time.DateOnly)).Scan(&wins).Error; e != nil {
				return e
			}
			if e := saveCandidate(tx, in, "week:"+end.Format(time.DateOnly), "streak", uidKey, wins); e != nil {
				return e
			}
		}
		return nil
	})
	return included, err
}

func saveCandidate(tx *gorm.DB, in GameCompletion, period, board, key string, streak int64) error {
	score := "?::numeric"
	args := []any{in.WinAmount}
	if board == "multiplier" {
		score = "?::numeric(100,50) / ?::numeric"
		args = append(args, in.BetAmount)
	}
	if board == "streak" {
		args = []any{streak}
	}
	prefix := []any{in.GameID, period, board, key, in.UID, in.BetID}
	prefix = append(prefix, args...)
	prefix = append(prefix, in.BetAmount, in.WinAmount, streak, in.EndedAt)
	sql := `INSERT INTO lobby_game_rank_candidates(game_id,period,board,entry_key,uid,bet_id,score,bet_amount,win_amount,streak,ended_at) VALUES(?,?,?,?,?,?,` + score + `,?,?,?,?) ON CONFLICT(game_id,period,board,entry_key) DO UPDATE SET score=EXCLUDED.score,bet_id=EXCLUDED.bet_id,bet_amount=EXCLUDED.bet_amount,win_amount=EXCLUDED.win_amount,streak=EXCLUDED.streak,ended_at=EXCLUDED.ended_at WHERE EXCLUDED.score>lobby_game_rank_candidates.score OR (EXCLUDED.score=lobby_game_rank_candidates.score AND EXCLUDED.ended_at<lobby_game_rank_candidates.ended_at)`
	if e := tx.Exec(sql, prefix...).Error; e != nil {
		return e
	}
	return tx.Exec(`DELETE FROM lobby_game_rank_candidates WHERE game_id=? AND period=? AND board=? AND entry_key NOT IN (SELECT entry_key FROM lobby_game_rank_candidates WHERE game_id=? AND period=? AND board=? ORDER BY score DESC,ended_at,entry_key LIMIT 50)`, in.GameID, period, board, in.GameID, period, board).Error
}

func (m *GameModel) ReadRTP(ctx context.Context, game string, minutes int, now time.Time) (RTPView, error) {
	out := RTPView{To: now.UTC().Truncate(time.Minute)}
	out.From = out.To.Add(-time.Duration(minutes) * time.Minute)
	var totals struct {
		BetAmount, WinAmount, Percent string
		Rounds                        int64
	}
	e := m.DB.WithContext(ctx).Raw(`SELECT COALESCE(SUM(bet_amount),0)::text AS bet_amount,COALESCE(SUM(win_amount),0)::text AS win_amount,COALESCE(SUM(rounds),0) AS rounds,COALESCE(ROUND(SUM(win_amount)*100/NULLIF(SUM(bet_amount),0),2),0)::text AS percent FROM lobby_game_rtp_minutes WHERE game_id=? AND minute>=? AND minute<?`, game, out.From, out.To).Scan(&totals).Error
	if e != nil {
		return out, e
	}
	out.BetAmount = totals.BetAmount
	out.WinAmount = totals.WinAmount
	out.Percent = totals.Percent
	out.Rounds = totals.Rounds
	out.HasData = out.BetAmount != "0"
	e = m.DB.WithContext(ctx).Raw("SELECT started_at FROM lobby_game_statistics_epoch WHERE id=1").Scan(&out.Since).Error
	return out, e
}

func (m *GameModel) ReadLeaderboard(ctx context.Context, game, board, period string, now time.Time) ([]RankView, time.Time, error) {
	db := m.DB.WithContext(ctx)
	var since time.Time
	if e := db.Raw("SELECT started_at FROM lobby_game_statistics_epoch WHERE id=1").Scan(&since).Error; e != nil {
		return nil, since, e
	}
	date := now.In(m.Location)
	keys := []string{"all"}
	if period == "today" {
		keys = []string{"day:" + date.Format(time.DateOnly)}
	}
	if period == "week" {
		keys = nil
		if board == "streak" {
			keys = []string{"week:" + date.Format(time.DateOnly)}
		} else {
			for i := 0; i < 7; i++ {
				keys = append(keys, "day:"+date.AddDate(0, 0, -i).Format(time.DateOnly))
			}
		}
	}
	// At most seven Top-50 sets; never reads the raw completion table. User profiles are joined only after LIMIT 20.
	query := `SELECT completion.platform_order_id::text AS platform_order_id,ranked.uid,ranked.bet_id,ranked.bet_amount::text,ranked.win_amount::text,ROUND(ranked.win_amount::numeric/ranked.bet_amount,2)::text AS multiplier,ranked.streak,ranked.ended_at,u.nickname,u.avatar_id,(completion.account_type='experience') AS experience_account FROM (SELECT * FROM lobby_game_rank_candidates WHERE game_id=? AND board=? AND period IN ? ORDER BY score DESC,ended_at,entry_key LIMIT 20) ranked JOIN lobby_game_completions completion ON completion.game_id=ranked.game_id AND completion.bet_id=ranked.bet_id JOIN lobby_users u ON u.uid=ranked.uid ORDER BY ranked.score DESC,ranked.ended_at,ranked.entry_key`
	var rows []RankView
	e := db.Raw(query, game, board, keys).Scan(&rows).Error
	return rows, since, e
}

// RebuildStatistics is an explicit operator action. The game lock keeps live updates outside the atomic replay.
func (m *GameModel) RebuildStatistics(ctx context.Context, game string) error {
	return m.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if e := tx.Exec("SELECT pg_advisory_xact_lock(hashtextextended(?,20261103))", game).Error; e != nil {
			return e
		}
		var records []LobbyGameCompletion
		if e := tx.Where("game_id=?", game).Order("uid,sequence").Find(&records).Error; e != nil {
			return e
		}
		for _, table := range []string{"lobby_game_completions", "lobby_game_rtp_minutes", "lobby_game_streaks", "lobby_game_streak_days", "lobby_game_rank_candidates"} {
			if e := tx.Table(table).Where("game_id=?", game).Delete(map[string]any{}).Error; e != nil {
				return e
			}
		}
		replay := &GameModel{DB: tx, Location: m.Location}
		for _, row := range records {
			if _, e := replay.CompleteGame(ctx, GameCompletion{PlatformOrderID: row.PlatformOrderID, UID: row.UID, GameID: row.GameID, BetID: row.BetID, Sequence: row.Sequence, BetAmount: row.BetAmount, WinAmount: row.WinAmount, StartedAt: row.StartedAt, EndedAt: row.EndedAt}); e != nil {
				return e
			}
		}
		return nil
	})
}
