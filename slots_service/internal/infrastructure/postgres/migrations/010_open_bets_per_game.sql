-- A player may keep independent unfinished rounds in different games.
-- Wallet commands remain serialized by the existing player advisory lock.
CREATE UNIQUE INDEX one_open_bet_per_subject_game
 ON bet_tickets(appname,appkey,uid,(data->>'GameID'))
 WHERE status IN ('prepared','active');
DROP INDEX one_open_bet_per_subject;
