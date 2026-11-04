-- Align legacy bound accounts that still carry the generated guest nickname.
-- Preserve names previously customized through the profile API.
UPDATE lobby_users
SET nickname = account
WHERE account IS NOT NULL AND account <> ''
  AND (nickname = '' OR nickname = 'player_' || uid::text);
