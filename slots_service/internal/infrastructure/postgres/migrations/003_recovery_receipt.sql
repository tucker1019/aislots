-- Locate the last committed frame without scanning a player's full bet history.
CREATE INDEX spin_receipts_next_token ON spin_request_receipts (scope, game_id, (data->'Frame'->>'nextRequestId'));
