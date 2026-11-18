-- Explicitly run on the test game database after upgrading all game writers.
-- Keep the table for historical migrations; never use CASCADE here.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '30s';
DO $$
BEGIN
 IF current_database() <> 'aislots' THEN
  RAISE EXCEPTION 'expected game database aislots';
 END IF;
END $$;
TRUNCATE TABLE public.outbox_events;
COMMIT;
SELECT pg_total_relation_size('public.outbox_events') AS remaining_bytes;
