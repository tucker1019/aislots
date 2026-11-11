// Package postgres persists game progress and a separate development-only test wallet.
package postgres

import (
	"aislots/slots_service/internal/application/play"
	"aislots/slots_service/internal/domain/identity"
	"aislots/slots_service/internal/engine"
	"aislots/slots_service/internal/infrastructure/lobby"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"io/fs"
	"math"
	"strings"
)

//go:embed migrations/*.sql
var migrationFiles embed.FS

type Store struct {
	pool  *pgxpool.Pool
	lobby *lobby.Client
}

func Open(ctx context.Context, url string) (*Store, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	if err = pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("PostgreSQL unavailable: %w", err)
	}
	return &Store{pool: pool}, nil
}
func (s *Store) Close()                         { s.pool.Close() }
func (s *Store) Ping(ctx context.Context) error { return s.pool.Ping(ctx) }
func (s *Store) Migrate(ctx context.Context) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(2026102301)`); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())`); err != nil {
		return err
	}
	files, err := fs.Glob(migrationFiles, "migrations/*.sql")
	if err != nil {
		return err
	}
	for _, file := range files {
		raw, err := migrationFiles.ReadFile(file)
		if err != nil {
			return err
		}
		version := strings.Split(strings.TrimPrefix(file, "migrations/"), "_")[0]
		sum := sha256.Sum256(raw)
		checksum := hex.EncodeToString(sum[:])
		var previous string
		err = tx.QueryRow(ctx, `SELECT checksum FROM schema_migrations WHERE version=$1`, version).Scan(&previous)
		if err == nil {
			if previous != checksum {
				return fmt.Errorf("applied migration %s checksum changed", version)
			}
			continue
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return err
		}
		if _, err = tx.Exec(ctx, string(raw)); err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO schema_migrations(version,checksum) VALUES($1,$2)`, version, checksum); err != nil {
			return err
		}
	}

	return tx.Commit(ctx)
}
func lockSubject(ctx context.Context, tx pgx.Tx, p identity.Context) error {
	key, _ := json.Marshal(p.Subject)
	_, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, string(key))
	return err
}
func (s *Store) CreateSession(ctx context.Context, hash string, session play.Session, initial int64) (int64, error) {
	if s.lobby != nil && s.lobby.Matches(session.Player) {
		raw, e := json.Marshal(session)
		if e != nil {
			return 0, e
		}
		_, e = s.pool.Exec(ctx, `INSERT INTO game_sessions(token_hash,data,expires_at) VALUES($1,$2,$3) ON CONFLICT(token_hash) DO NOTHING`, hash, raw, session.ExpiresAt)
		return initial, e
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(context.Background())
	p := session.Player
	if err = lockSubject(ctx, tx, p); err != nil {
		return 0, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO test_wallets(appname,appkey,uid,currency,balance) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`, p.Subject.AppName, p.Subject.AppKey, p.Subject.UID, p.Currency, initial); err != nil {
		return 0, err
	}
	raw, err := json.Marshal(session)
	if err != nil {
		return 0, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO game_sessions(token_hash,data,expires_at) VALUES($1,$2,$3)`, hash, raw, session.ExpiresAt); err != nil {
		return 0, err
	}
	var balance int64
	if err = tx.QueryRow(ctx, `SELECT balance FROM test_wallets WHERE appname=$1 AND appkey=$2 AND uid=$3 AND currency=$4`, p.Subject.AppName, p.Subject.AppKey, p.Subject.UID, p.Currency).Scan(&balance); err != nil {
		return 0, err
	}
	return balance, tx.Commit(ctx)
}
func (s *Store) Session(ctx context.Context, hash string) (play.Session, error) {
	var raw []byte
	err := s.pool.QueryRow(ctx, `SELECT data FROM game_sessions WHERE token_hash=$1 AND expires_at>now()`, hash).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return play.Session{}, play.ErrUnauthorized
	}
	if err != nil {
		return play.Session{}, err
	}
	var session play.Session
	err = json.Unmarshal(raw, &session)
	return session, err
}
func (s *Store) WithPlayer(ctx context.Context, p identity.Context, fn func(play.Tx) error) error {
	if s.lobby != nil && s.lobby.Matches(p) {
		return s.withLobbyPlayer(ctx, p, fn)
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	if err = lockSubject(ctx, tx, p); err != nil {
		return err
	}
	state := &transaction{tx: tx, player: p}
	if err = tx.QueryRow(ctx, `SELECT balance FROM test_wallets WHERE appname=$1 AND appkey=$2 AND uid=$3 AND currency=$4 FOR UPDATE`, p.Subject.AppName, p.Subject.AppKey, p.Subject.UID, p.Currency).Scan(&state.balance); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return play.ErrUnauthorized
		}
		return err
	}
	if err = fn(state); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type transaction struct {
	tx         pgx.Tx
	player     identity.Context
	balance    int64
	remote     bool
	operations []walletOperation
}

func (t *transaction) Balance() int64 { return t.balance }
func (t *transaction) FindOpen(ctx context.Context, gameID string) (play.Ticket, bool, error) {
	p := t.player.Subject
	var raw []byte
	err := t.tx.QueryRow(ctx, `SELECT data FROM bet_tickets WHERE appname=$1 AND appkey=$2 AND uid=$3 AND data->>'GameID'=$4 AND status IN ('prepared','active')`, p.AppName, p.AppKey, p.UID, gameID).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return play.Ticket{}, false, nil
	}
	if err != nil {
		return play.Ticket{}, false, err
	}
	var value play.Ticket
	err = json.Unmarshal(raw, &value)
	return value, true, err
}
func (t *transaction) Ticket(ctx context.Context, id string) (play.Ticket, error) {
	p := t.player.Subject
	var raw []byte
	err := t.tx.QueryRow(ctx, `SELECT data FROM bet_tickets WHERE id=$1 AND appname=$2 AND appkey=$3 AND uid=$4`, id, p.AppName, p.AppKey, p.UID).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return play.Ticket{}, play.ErrNotFound
	}
	if err != nil {
		return play.Ticket{}, err
	}
	var value play.Ticket
	err = json.Unmarshal(raw, &value)
	return value, err
}
func (t *transaction) SaveTicket(ctx context.Context, value play.Ticket) error {
	if value.Player.Subject != t.player.Subject {
		return play.ErrUnauthorized
	}
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	p := t.player.Subject
	if _, err = t.tx.Exec(ctx, `INSERT INTO bet_tickets(id,appname,appkey,uid,status,data) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET status=excluded.status,data=excluded.data,updated_at=now()`, value.ID, p.AppName, p.AppKey, p.UID, value.Status, raw); err != nil {
		return err
	}
	if value.Status == "active" || value.Status == "complete" {
		_, err = t.tx.Exec(ctx, `INSERT INTO bet_orders(bet_id,status,data) VALUES($1,$2,$3) ON CONFLICT(bet_id) DO UPDATE SET status=excluded.status,data=excluded.data,updated_at=now()`, value.ID, value.Status, raw)
	}
	if err == nil && t.remote && value.Status == "complete" {
		_, err = t.tx.Exec(ctx, `WITH seq AS (
 INSERT INTO game_statistics_sequences(game_id,uid,sequence)
 SELECT $1,$2,1 WHERE NOT EXISTS(SELECT 1 FROM game_statistics_outbox WHERE bet_id=$3)
 ON CONFLICT(game_id,uid) DO UPDATE SET sequence=game_statistics_sequences.sequence+1 RETURNING sequence)
 INSERT INTO game_statistics_outbox(game_id,uid,bet_id,sequence,bet_amount,win_amount,started_at,ended_at)
 SELECT $1,$2,$3,seq.sequence,$4,$5,COALESCE((SELECT MIN(created_at) FROM spin_steps WHERE bet_id=$3),now()),now() FROM seq
 ON CONFLICT(bet_id) DO NOTHING`, value.GameID, p.UID, value.ID, value.Amount, value.TotalWin)
	}
	return err
}
func (t *transaction) State(ctx context.Context, id string) (engine.State, error) {
	var raw []byte
	p := t.player
	err := t.tx.QueryRow(ctx, `SELECT data FROM player_game_states WHERE appname=$1 AND appkey=$2 AND uid=$3 AND game_id=$4 AND country=$5 AND currency=$6`, p.Subject.AppName, p.Subject.AppKey, p.Subject.UID, id, p.Country, p.Currency).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return engine.State{}, nil
	}
	if err != nil {
		return engine.State{}, err
	}
	var value engine.State
	err = json.Unmarshal(raw, &value)
	return value, err
}
func (t *transaction) SaveState(ctx context.Context, id string, value engine.State) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	p := t.player
	_, err = t.tx.Exec(ctx, `INSERT INTO player_game_states(appname,appkey,uid,game_id,country,currency,data) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(appname,appkey,uid,game_id,country,currency) DO UPDATE SET data=excluded.data`, p.Subject.AppName, p.Subject.AppKey, p.Subject.UID, id, p.Country, p.Currency, raw)
	return err
}
func (t *transaction) Spin(ctx context.Context, id string, index int) (play.StoredSpin, bool, error) {
	return readJSON[play.StoredSpin](ctx, t.tx, `SELECT data FROM game_spins WHERE bet_id=$1 AND spin_index=$2`, id, index)
}
func (t *transaction) SaveSpin(ctx context.Context, id string, index int, value play.StoredSpin) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	_, err = t.tx.Exec(ctx, `INSERT INTO game_spins(bet_id,spin_index,data) VALUES($1,$2,$3)`, id, index, raw)
	return err
}
func (t *transaction) Frame(ctx context.Context, id string, spin, step int) (play.Frame, bool, error) {
	return readJSON[play.Frame](ctx, t.tx, `SELECT response FROM spin_steps WHERE bet_id=$1 AND spin_index=$2 AND step_index=$3`, id, spin, step)
}
func (t *transaction) SaveFrame(ctx context.Context, value play.Frame) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	_, err = t.tx.Exec(ctx, `INSERT INTO spin_steps(bet_id,spin_index,step_index,response) VALUES($1,$2,$3,$4)`, value.BetID, value.SpinIndex, value.StepIndex, raw)
	return err
}

func (t *transaction) EnqueueOutbox(ctx context.Context, key, eventType, aggregateID string, payload any) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = t.tx.Exec(ctx, `INSERT INTO outbox_events(event_key,event_type,aggregate_id,payload) VALUES($1,$2,$3,$4) ON CONFLICT(event_key) DO NOTHING`, key, eventType, aggregateID, raw)
	return err
}
func readJSON[T any](ctx context.Context, tx pgx.Tx, sql string, args ...any) (T, bool, error) {
	var value T
	var raw []byte
	err := tx.QueryRow(ctx, sql, args...).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return value, false, nil
	}
	if err != nil {
		return value, false, err
	}
	err = json.Unmarshal(raw, &value)
	return value, true, err
}
func (t *transaction) Wallet(ctx context.Context, id, kind string, amount int64) (int64, error) {
	if t.remote {
		return t.remoteWallet(ctx, id, kind, amount)
	}
	if kind != "debit" && kind != "credit" || kind == "debit" && amount >= 0 || kind == "credit" && amount <= 0 {
		return 0, fmt.Errorf("invalid wallet operation")
	}
	var prior, after int64
	err := t.tx.QueryRow(ctx, `SELECT amount,balance_after FROM test_wallet_ledger WHERE operation_id=$1`, id).Scan(&prior, &after)
	if err == nil {
		if prior != amount {
			return 0, play.ErrConflict
		}
		return t.balance, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return 0, err
	}
	if amount < 0 && t.balance < -amount {
		return 0, play.ErrFunds
	}
	if amount > 0 && t.balance > math.MaxInt64-amount {
		return 0, fmt.Errorf("wallet overflow")
	}
	balance := t.balance + amount
	p := t.player
	if _, err = t.tx.Exec(ctx, `UPDATE test_wallets SET balance=$5 WHERE appname=$1 AND appkey=$2 AND uid=$3 AND currency=$4`, p.Subject.AppName, p.Subject.AppKey, p.Subject.UID, p.Currency, balance); err != nil {
		return 0, err
	}
	if _, err = t.tx.Exec(ctx, `INSERT INTO test_wallet_ledger(operation_id,appname,appkey,uid,currency,kind,amount,balance_after) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, id, p.Subject.AppName, p.Subject.AppKey, p.Subject.UID, p.Currency, kind, amount, balance); err != nil {
		return 0, err
	}
	t.balance = balance
	return balance, nil
}

func (t *transaction) requestScope() string { raw, _ := json.Marshal(t.player); return string(raw) }
func (t *transaction) SpinToken(ctx context.Context, gameID string) (string, error) {
	scope := t.requestScope()
	if _, err := t.tx.Exec(ctx, `INSERT INTO spin_request_tokens(scope,game_id,token) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, scope, gameID, rand.Text()); err != nil {
		return "", err
	}
	var token string
	err := t.tx.QueryRow(ctx, `SELECT token FROM spin_request_tokens WHERE scope=$1 AND game_id=$2`, scope, gameID).Scan(&token)
	return token, err
}
func (t *transaction) SpinReceipt(ctx context.Context, gameID, id string) (play.SpinReceipt, bool, error) {
	var raw []byte
	var receipt play.SpinReceipt
	err := t.tx.QueryRow(ctx, `SELECT data FROM spin_request_receipts WHERE scope=$1 AND game_id=$2 AND request_id=$3`, t.requestScope(), gameID, id).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return receipt, false, nil
	}
	if err != nil {
		return receipt, false, err
	}
	err = json.Unmarshal(raw, &receipt)
	return receipt, true, err
}

// LastSpinReceipt follows the current token back to its committed receipt.
// It restores presentation only; it neither advances the cursor nor touches the wallet.
func (t *transaction) LastSpinReceipt(ctx context.Context, gameID, next string) (play.SpinReceipt, bool, error) {
	var raw []byte
	var receipt play.SpinReceipt
	err := t.tx.QueryRow(ctx, `SELECT data FROM spin_request_receipts WHERE scope=$1 AND game_id=$2 AND data->'Frame'->>'nextRequestId'=$3`, t.requestScope(), gameID, next).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return receipt, false, nil
	}
	if err != nil {
		return receipt, false, err
	}
	err = json.Unmarshal(raw, &receipt)
	return receipt, true, err
}

func (t *transaction) SaveSpinReceipt(ctx context.Context, gameID, id string, receipt play.SpinReceipt, next string) error {
	raw, err := json.Marshal(receipt)
	if err != nil {
		return err
	}
	scope := t.requestScope()
	if _, err = t.tx.Exec(ctx, `INSERT INTO spin_request_receipts(scope,game_id,request_id,data) VALUES($1,$2,$3,$4)`, scope, gameID, id, raw); err != nil {
		return err
	}
	result, err := t.tx.Exec(ctx, `UPDATE spin_request_tokens SET token=$1 WHERE scope=$2 AND game_id=$3 AND token=$4`, next, scope, gameID, id)
	if err == nil && result.RowsAffected() != 1 {
		return play.ErrConflict
	}
	return err
}
