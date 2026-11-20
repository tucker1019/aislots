-- Only eligible completed orders enter this index; money remains integer cents.
-- Exact NUMERIC comparisons avoid both bigint overflow and rounded multiplier admission.
CREATE INDEX IF NOT EXISTS game_completions_recent_wins
ON lobby_game_completions(ended_at DESC, platform_order_id DESC)
WHERE included AND (
 win_amount::numeric >= bet_amount::numeric * 20
 OR (win_amount >= 20000000 AND win_amount::numeric >= bet_amount::numeric * 5)
);
