ALTER TABLE lobby_invite_rewards ADD COLUMN IF NOT EXISTS slot bigint;
WITH ranked AS (
 SELECT w.invitee_uid,COALESCE((SELECT MAX(x.slot) FROM lobby_invite_rewards x WHERE x.inviter_uid=w.inviter_uid),0)+ROW_NUMBER() OVER(PARTITION BY w.inviter_uid ORDER BY w.earned_at,w.invitee_uid) AS slot
 FROM lobby_invite_rewards w WHERE w.slot IS NULL
) UPDATE lobby_invite_rewards w SET slot=r.slot FROM ranked r WHERE w.invitee_uid=r.invitee_uid;
ALTER TABLE lobby_invite_rewards ALTER COLUMN slot SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS lobby_invite_rewards_slot ON lobby_invite_rewards(inviter_uid,slot);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='lobby_invite_slot_positive' AND conrelid='lobby_invite_rewards'::regclass) THEN
 ALTER TABLE lobby_invite_rewards ADD CONSTRAINT lobby_invite_slot_positive CHECK(slot>0);
 END IF;
END $$;
