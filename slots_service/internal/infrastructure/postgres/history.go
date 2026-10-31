package postgres

import (
	"aislots/slots_service/internal/application/play"
	"aislots/slots_service/internal/domain/identity"
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	"math/big"
	"strconv"
	"time"
)

func recordFromTicket(raw []byte, created, updated time.Time) (play.BetRecord, error) {
	var ticket play.Ticket
	if err := json.Unmarshal(raw, &ticket); err != nil {
		return play.BetRecord{}, err
	}
	return play.BetRecord{BetID: ticket.ID, GameID: ticket.GameID, BetAmount: strconv.FormatInt(ticket.Amount, 10), TotalWinAmount: strconv.FormatInt(ticket.TotalWin, 10), Status: ticket.Status, ProfitAmount: strconv.FormatInt(ticket.TotalWin-ticket.Amount, 10), Country: ticket.Player.Country, Currency: ticket.Player.Currency, CreatedAt: created, UpdatedAt: updated}, nil
}

// 同一筛选结果的全量汇总不受分页边界影响。
func (s *Store) ReadBetRecords(ctx context.Context, player identity.Context, game string, q play.RecordQuery) ([]play.BetRecord, play.BetSummary, error) {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, play.BetSummary{}, err
	}
	defer tx.Rollback(context.Background())
	var from, to, boundary any
	if !q.Filter.From.IsZero() {
		from = q.Filter.From
		to = q.Filter.To
	}
	if !q.BeforeTime.IsZero() {
		boundary = q.BeforeTime
	}
	args := []any{player.Subject.AppName, player.Subject.AppKey, player.Subject.UID, game, player.Country, player.Currency, from, to}
	const where = ` FROM bet_tickets t WHERE t.appname=$1 AND t.appkey=$2 AND t.uid=$3 AND t.data->>'GameID'=$4
 AND t.data->'Player'->>'country'=$5 AND t.data->'Player'->>'currency'=$6
 AND t.status IN ('active','complete')
 AND ($7::timestamptz IS NULL OR t.created_at >= $7) AND ($8::timestamptz IS NULL OR t.created_at < $8)`
	var summary play.BetSummary
	err = tx.QueryRow(ctx, `SELECT count(*),COALESCE(sum((t.data->>'Amount')::numeric),0)::text,COALESCE(sum((t.data->>'TotalWin')::numeric),0)::text,COALESCE(sum((t.data->>'TotalWin')::numeric-(t.data->>'Amount')::numeric),0)::text`+where, args...).Scan(&summary.RecordCount, &summary.BetAmount, &summary.TotalWinAmount, &summary.ProfitAmount)
	if err != nil {
		return nil, summary, err
	}
	args = append(args, boundary, q.BeforeID, q.Limit)
	rows, err := tx.Query(ctx, `SELECT t.data,t.created_at,t.updated_at,
 (SELECT count(*) FROM spin_steps s WHERE s.bet_id=t.id),
 (SELECT count(*) FROM spin_steps s WHERE s.bet_id=t.id AND jsonb_typeof(s.response->'wins')='array' AND s.response->'wins'<>'[]'::jsonb)`+where+`
 AND ($9::timestamptz IS NULL OR (t.created_at,t.id)<($9::timestamptz,$10::text)) ORDER BY t.created_at DESC,t.id DESC LIMIT $11`, args...)
	if err != nil {
		return nil, summary, err
	}
	items := []play.BetRecord{}
	for rows.Next() {
		var raw []byte
		var created, updated time.Time
		var rounds, wins int
		if err = rows.Scan(&raw, &created, &updated, &rounds, &wins); err != nil {
			rows.Close()
			return nil, summary, err
		}
		record, e := recordFromTicket(raw, created, updated)
		if e != nil {
			rows.Close()
			return nil, summary, e
		}
		record.TotalRoundCount = rounds
		record.WinningRoundCount = wins
		items = append(items, record)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return nil, summary, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, summary, err
	}
	return items, summary, nil
}

func (s *Store) ReadBetReplay(ctx context.Context, player identity.Context, game, id string, q play.ReplayQuery) (play.BetRecord, []play.ReplayFrame, error) {
	// 摘要与当前页盘面在同一只读快照中，下注可并行结算，查询不持有钱包锁。
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return play.BetRecord{}, nil, err
	}
	defer tx.Rollback(context.Background())
	var raw []byte
	var created, updated time.Time
	var rounds, wins int
	err = tx.QueryRow(ctx, `SELECT data,created_at,updated_at,
 (SELECT count(*) FROM spin_steps s WHERE s.bet_id=bet_tickets.id),
 (SELECT count(*) FROM spin_steps s WHERE s.bet_id=bet_tickets.id AND jsonb_typeof(s.response->'wins')='array' AND s.response->'wins'<>'[]'::jsonb)
 FROM bet_tickets
 WHERE id=$1 AND appname=$2 AND appkey=$3 AND uid=$4 AND data->>'GameID'=$5
 AND data->'Player'->>'country'=$6 AND data->'Player'->>'currency'=$7
 AND status IN ('active','complete')`, id, player.Subject.AppName, player.Subject.AppKey, player.Subject.UID, game, player.Country, player.Currency).Scan(&raw, &created, &updated, &rounds, &wins)
	if errors.Is(err, pgx.ErrNoRows) {
		return play.BetRecord{}, nil, play.ErrNotFound
	}
	if err != nil {
		return play.BetRecord{}, nil, err
	}
	record, err := recordFromTicket(raw, created, updated)
	if err != nil {
		return play.BetRecord{}, nil, err
	}
	record.TotalRoundCount = rounds
	record.WinningRoundCount = wins
	// 只返回已提交盘面。game_spins仅提取投注单位和此前raw累计值，不读取或返回未来盘面。
	rows, err := tx.Query(ctx, `SELECT s.response,s.created_at,
 COALESCE(g.data->'Result'->>'exactWinMinorUnits','0'),
 COALESCE(g.data->'Result'->'round'->>'rawMultiplier','0'),
 COALESCE((g.data->'Result'->>'lineCount')::int,0),
 COALESCE((SELECT sum((v.value->>'rawPayout')::numeric)::text FROM jsonb_array_elements(g.data->'Result'->'round'->'steps') WITH ORDINALITY v(value,n) WHERE v.n<s.step_index),'0')
 FROM spin_steps s LEFT JOIN game_spins g ON g.bet_id=s.bet_id AND g.spin_index=s.spin_index
 WHERE s.bet_id=$1 AND (s.spin_index,s.step_index)>($2,$3) ORDER BY s.spin_index,s.step_index LIMIT $4`, id, q.AfterSpin, q.AfterStep, q.Limit)
	if err != nil {
		return play.BetRecord{}, nil, err
	}
	frames := []play.ReplayFrame{}
	for rows.Next() {
		var frame play.ReplayFrame
		var data []byte
		var exact, total string
		if err = rows.Scan(&data, &frame.SettledAt, &exact, &total, &frame.LineCount, &frame.PriorRawPayout); err != nil {
			rows.Close()
			return play.BetRecord{}, nil, err
		}
		if err = json.Unmarshal(data, &frame.Frame); err != nil {
			rows.Close()
			return play.BetRecord{}, nil, err
		}
		if e, ok := new(big.Rat).SetString(exact); ok {
			if r, ok := new(big.Rat).SetString(total); ok && r.Sign() > 0 {
				frame.PayoutUnit = new(big.Rat).Quo(e, r).RatString()
			}
		}
		if frame.PayoutUnit == "" && frame.LineCount > 0 {
			if bet, ok := new(big.Rat).SetString(strconv.FormatInt(frame.BetAmount, 10)); ok {
				frame.PayoutUnit = new(big.Rat).Quo(bet, big.NewRat(int64(frame.LineCount), 1)).RatString()
			}
		}
		frames = append(frames, frame)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return play.BetRecord{}, nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return play.BetRecord{}, nil, err
	}
	return record, frames, nil
}
