package postgres

import (
	"aislots/slots_service/internal/application/play"
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
)

// The session advisory lock serializes commands across HTTP retries and server instances.
// Each frame uses its normal short settlement transaction; its token is saved before sending.
func (s *Store) RunAutoRound(ctx context.Context, session play.Session, id string, amount int64, run func(*play.AutoRoundState, func() error) error) (play.AutoRoundReply, error) {
	p := session.Player
	conn, e := s.pool.Acquire(ctx)
	if e != nil {
		return play.AutoRoundReply{}, e
	}
	defer conn.Release()
	key, _ := json.Marshal(p.Subject)
	// Do not return a pooled connection with a session-level lock still held.
	defer func() {
		cleanup, cancel := context.WithTimeout(context.Background(), 5e9)
		defer cancel()
		if _, err := conn.Exec(cleanup, "SELECT pg_advisory_unlock(hashtextextended($1,20261105))", string(key)); err != nil {
			_ = conn.Conn().Close(cleanup)
		}
	}()
	var locked bool
	if e = conn.QueryRow(ctx, "SELECT pg_try_advisory_lock(hashtextextended($1,20261105))", string(key)).Scan(&locked); e != nil {
		return play.AutoRoundReply{}, e
	}
	if !locked {
		return play.AutoRoundReply{}, play.ErrConflict
	}
	args := []any{p.Subject.AppName, p.Subject.AppKey, p.Subject.UID, session.GameID, id}
	job := play.AutoRoundState{RequestID: id, Amount: amount}
	var country, currency string
	e = conn.QueryRow(ctx, `SELECT amount,country,currency,spin_token,bet_id,done FROM game_auto_rounds WHERE appname=$1 AND appkey=$2 AND uid=$3 AND game_id=$4 AND request_id=$5`, args...).Scan(&job.Amount, &country, &currency, &job.SpinToken, &job.BetID, &job.Done)
	if errors.Is(e, pgx.ErrNoRows) {
		_, e = conn.Exec(ctx, `INSERT INTO game_auto_rounds(appname,appkey,uid,game_id,request_id,amount,country,currency) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, append(args, amount, p.Country, p.Currency)...)
	} else if e == nil && (job.Amount != amount || country != p.Country || currency != p.Currency) {
		e = play.ErrConflict
	}
	if e != nil {
		return play.AutoRoundReply{}, e
	}
	save := func() error {
		_, err := conn.Exec(ctx, `UPDATE game_auto_rounds SET spin_token=$6,bet_id=$7,done=$8,updated_at=now() WHERE appname=$1 AND appkey=$2 AND uid=$3 AND game_id=$4 AND request_id=$5`, append(args, job.SpinToken, job.BetID, job.Done)...)
		return err
	}
	if !job.Done {
		e = run(&job, save)
	}
	if e != nil {
		return play.AutoRoundReply{}, e
	}
	return play.AutoRoundReply{Status: "complete", RequestID: id, BetID: job.BetID}, nil
}
