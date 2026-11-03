package postgres

import (
	"aislots/slots_service/internal/application/play"
	"aislots/slots_service/internal/domain/identity"
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
)

func (s *Store) RankReplaySession(ctx context.Context, game, betID, uid string) (play.Session, error) {
	var raw []byte
	err := s.pool.QueryRow(ctx, `SELECT data FROM bet_tickets WHERE id=$1 AND uid=$2 AND data->>'GameID'=$3 AND status='complete'`, betID, uid, game).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return play.Session{}, play.ErrNotFound
	}
	if err != nil {
		return play.Session{}, err
	}
	var row struct{ Player identity.Context }
	if err = json.Unmarshal(raw, &row); err != nil {
		return play.Session{}, err
	}
	if !row.Player.Valid() || row.Player.Subject.UID != uid {
		return play.Session{}, play.ErrNotFound
	}
	return play.Session{Player: row.Player, GameID: game}, nil
}
