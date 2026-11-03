package postgres

import (
	"aislots/slots_service/internal/application/play"
	"aislots/slots_service/internal/domain/identity"
	"aislots/slots_service/internal/infrastructure/lobby"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"math"
	"strconv"
	"strings"
	"time"
)

func (s *Store) UseLobby(c *lobby.Client) { s.lobby = c }

type walletOperation struct {
	BetID, GameID, Kind string
	Amount              int64
}

func (t *transaction) remoteWallet(ctx context.Context, id, kind string, amount int64) (int64, error) {
	if (kind != "debit" && kind != "credit") || kind == "debit" && amount >= 0 || kind == "credit" && amount <= 0 {
		return 0, play.ErrInvalid
	}
	if amount < 0 && t.balance < -amount {
		return 0, play.ErrFunds
	}
	if amount > 0 && t.balance > math.MaxInt64-amount {
		return 0, fmt.Errorf("balance overflow")
	}
	betID := strings.Split(id, ":")[0]
	ticket, e := t.Ticket(ctx, betID)
	if e != nil {
		return 0, e
	}
	t.balance += amount
	t.operations = append(t.operations, walletOperation{betID, ticket.GameID, kind, amount})
	return t.balance, nil
}

// The journal contains only server-generated bound statements, never SQL supplied over HTTP.
// Recording rolls back the speculative transaction; recovery replays these exact writes after an idempotent lobby receipt.
type boundArg struct {
	Kind  string
	Value json.RawMessage
}
type mutation struct {
	SQL  string
	Args []boundArg
}
type recordingTx struct {
	pgx.Tx
	writes []mutation
}

func (t *recordingTx) Exec(ctx context.Context, q string, args ...any) (pgconn.CommandTag, error) {
	result, e := t.Tx.Exec(ctx, q, args...)
	if e != nil {
		return result, e
	}
	m := mutation{SQL: q}
	for _, a := range args {
		var kind string
		switch a.(type) {
		case string:
			kind = "string"
		case []byte:
			kind = "bytes"
		case int, int32, int64:
			kind = "int"
		case time.Time:
			kind = "time"
		default:
			return result, fmt.Errorf("unsupported journal argument %T", a)
		}
		b, e := json.Marshal(a)
		if e != nil {
			return result, e
		}
		m.Args = append(m.Args, boundArg{kind, b})
	}
	t.writes = append(t.writes, m)
	return result, nil
}
func (m mutation) arguments() (out []any, e error) {
	for _, a := range m.Args {
		var v any
		switch a.Kind {
		case "string":
			var s string
			e = json.Unmarshal(a.Value, &s)
			v = s
		case "bytes":
			var b []byte
			e = json.Unmarshal(a.Value, &b)
			v = b
		case "int":
			var n int64
			e = json.Unmarshal(a.Value, &n)
			v = n
		case "time":
			var t time.Time
			e = json.Unmarshal(a.Value, &t)
			v = t
		default:
			e = fmt.Errorf("invalid journal type")
		}
		if e != nil {
			return nil, e
		}
		out = append(out, v)
	}
	return out, nil
}

type pendingSettlement struct {
	Request lobby.Settlement
	Writes  []mutation
}

func (s *Store) withLobbyPlayer(ctx context.Context, p identity.Context, fn func(play.Tx) error) error {
	conn, e := s.pool.Acquire(ctx)
	if e != nil {
		return e
	}
	defer conn.Release()
	key, _ := json.Marshal(p.Subject)
	scope := string(key)
	if _, e = conn.Exec(ctx, `SELECT pg_advisory_lock(hashtextextended($1,0))`, scope); e != nil {
		_ = conn.Conn().Close(context.Background())
		return e
	}
	defer func() {
		cleanup, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if _, e := conn.Exec(cleanup, `SELECT pg_advisory_unlock(hashtextextended($1,0))`, scope); e != nil {
			_ = conn.Conn().Close(cleanup)
		}
	}()
	if e = s.finishPending(ctx, conn, scope); e != nil {
		return e
	}
	balance, e := s.lobby.Balance(ctx, p)
	if e != nil {
		return e
	}
	tx, e := conn.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(context.Background())
	recorder := &recordingTx{Tx: tx}
	state := &transaction{tx: recorder, player: p, balance: balance, remote: true}
	if e = fn(state); e != nil {
		return e
	}
	if len(state.operations) == 0 {
		return tx.Commit(ctx)
	}
	uid, e := strconv.ParseInt(p.Subject.UID, 10, 64)
	if e != nil {
		return e
	}
	plan := pendingSettlement{Request: lobby.Settlement{UID: uid}, Writes: recorder.writes}
	for _, op := range state.operations {
		if plan.Request.BetID != "" && (op.BetID != plan.Request.BetID || op.GameID != plan.Request.GameID) {
			return fmt.Errorf("mixed settlement")
		}
		plan.Request.BetID = op.BetID
		plan.Request.GameID = op.GameID
		if op.Kind == "debit" {
			plan.Request.Debit += -op.Amount
		} else {
			plan.Request.Credit += op.Amount
		}
	}
	// Bind this persisted bet and frame to the server-issued nonce; every retry of the intent keeps this exact money order.
	for _, m := range recorder.writes {
		if strings.HasPrefix(m.SQL, "INSERT INTO spin_request_receipts") {
			args, e := m.arguments()
			if e != nil {
				return e
			}
			hash := sha256.Sum256([]byte(args[0].(string) + "\x00" + args[1].(string) + "\x00" + args[2].(string) + "\x00" + plan.Request.BetID))
			plan.Request.RequestID = "spin_" + hex.EncodeToString(hash[:])
			break
		}
	}
	if plan.Request.RequestID == "" {
		return fmt.Errorf("live settlement requires a spin receipt")
	}
	// Rollback first: the only durable visible change before HTTP is the intent, never an unsettled display frame.
	if e = tx.Rollback(ctx); e != nil {
		return e
	}
	raw, e := json.Marshal(plan)
	if e != nil {
		return e
	}
	if _, e = conn.Exec(ctx, `INSERT INTO lobby_pending_settlements(scope,data) VALUES($1,$2)`, scope, raw); e != nil {
		return e
	}
	return s.finishPending(ctx, conn, scope)
}
func (s *Store) finishPending(ctx context.Context, conn interface {
	Begin(context.Context) (pgx.Tx, error)
	QueryRow(context.Context, string, ...any) pgx.Row
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}, scope string) error {
	var raw []byte
	e := conn.QueryRow(ctx, `SELECT data FROM lobby_pending_settlements WHERE scope=$1`, scope).Scan(&raw)
	if errors.Is(e, pgx.ErrNoRows) {
		return nil
	}
	if e != nil {
		return e
	}
	var plan pendingSettlement
	if e = json.Unmarshal(raw, &plan); e != nil {
		return e
	}
	status, balance, e := s.lobby.Settle(ctx, plan.Request)
	if e != nil {
		return e
	}
	if status == "rejected" {
		if _, e = conn.Exec(ctx, `DELETE FROM lobby_pending_settlements WHERE scope=$1`, scope); e != nil {
			return e
		}
		return play.ErrFunds
	}
	tx, e := conn.Begin(ctx)
	if e != nil {
		return e
	}
	defer tx.Rollback(context.Background())
	for _, m := range plan.Writes {
		args, e := m.arguments()
		if e != nil {
			return e
		}
		// Historical frames retain the lobby's actual settlement balance, including concurrent recharges.
		if strings.HasPrefix(m.SQL, "INSERT INTO spin_steps") || strings.HasPrefix(m.SQL, "INSERT INTO outbox_events") && args[1] == "spin.frame.settled" {
			var f play.Frame
			if e = json.Unmarshal(args[3].([]byte), &f); e != nil {
				return e
			}
			f.Balance = balance
			args[3], e = json.Marshal(f)
			if e != nil {
				return e
			}
		}
		if strings.HasPrefix(m.SQL, "INSERT INTO spin_request_receipts") {
			var r play.SpinReceipt
			if e = json.Unmarshal(args[3].([]byte), &r); e != nil {
				return e
			}
			r.Frame.Balance = balance
			args[3], e = json.Marshal(r)
			if e != nil {
				return e
			}
		}
		if _, e = tx.Exec(ctx, m.SQL, args...); e != nil {
			return e
		}
	}
	if _, e = tx.Exec(ctx, `DELETE FROM lobby_pending_settlements WHERE scope=$1`, scope); e != nil {
		return e
	}
	return tx.Commit(ctx)
}

// The response must come from the committed receipt, not the speculative balance used while planning.
func (s *Store) SettledReceipt(ctx context.Context, p identity.Context, game, id string) (play.SpinReceipt, bool, error) {
	scope, _ := json.Marshal(p)
	var r play.SpinReceipt
	var raw []byte
	e := s.pool.QueryRow(ctx, `SELECT data FROM spin_request_receipts WHERE scope=$1 AND game_id=$2 AND request_id=$3`, string(scope), game, id).Scan(&raw)
	if errors.Is(e, pgx.ErrNoRows) {
		return r, false, nil
	}
	if e != nil {
		return r, false, e
	}
	e = json.Unmarshal(raw, &r)
	return r, true, e
}
