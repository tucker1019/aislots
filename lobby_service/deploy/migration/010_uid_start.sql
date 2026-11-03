-- Apply to both new and existing databases. Never reuse an allocated UID.
DO $$
DECLARE
 uid_sequence regclass;
 allocated bigint;
 was_called boolean;
 next_uid bigint;
BEGIN
 LOCK TABLE lobby_users IN ACCESS EXCLUSIVE MODE;
 uid_sequence := pg_get_serial_sequence('lobby_users', 'uid')::regclass;
 EXECUTE format('SELECT last_value, is_called FROM %s', uid_sequence) INTO allocated, was_called;
 SELECT GREATEST(10000001::bigint, COALESCE(MAX(uid), 0) + 1,
                 CASE WHEN was_called THEN allocated + 1 ELSE allocated END)
 INTO next_uid FROM lobby_users;
 EXECUTE format('ALTER SEQUENCE %s MINVALUE 10000001 START WITH 10000001 RESTART WITH %s', uid_sequence, next_uid);
END $$;
