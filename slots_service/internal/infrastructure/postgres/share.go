package postgres

import (
	"aislots/slots_service/internal/application/play"
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
)

func (s *Store) SaveReplayShare(ctx context.Context, hash string, session play.Session, betID string) error {
	raw, err := json.Marshal(play.Session{Player: session.Player, GameID: session.GameID})
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `INSERT INTO replay_shares(token_hash,bet_id,game_id,session_data) VALUES($1,$2,$3,$4)`, hash, betID, session.GameID, raw)
	return err
}
func (s *Store) ReplayShareSession(ctx context.Context, hash, gameID, betID string) (play.Session, error) {
	var raw []byte
	err := s.pool.QueryRow(ctx, `SELECT session_data FROM replay_shares WHERE token_hash=$1 AND game_id=$2 AND bet_id=$3`, hash, gameID, betID).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return play.Session{}, play.ErrNotFound
	}
	if err != nil {
		return play.Session{}, err
	}
	var session play.Session
	err = json.Unmarshal(raw, &session)
	return session, err
}
