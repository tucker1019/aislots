-- Platform-owned, stable order identity; maps one complete paid/free chain to its game bet.
ALTER TABLE lobby_game_completions ADD COLUMN IF NOT EXISTS platform_order_id bigint GENERATED ALWAYS AS IDENTITY;
CREATE UNIQUE INDEX IF NOT EXISTS game_platform_order ON lobby_game_completions(platform_order_id);
