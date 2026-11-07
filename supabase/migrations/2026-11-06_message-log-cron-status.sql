BEGIN;

-- New column to hold the error string when a cron heartbeat records status = 'error'.
-- Separate from the existing 'error' column, which crons use for a stats summary on 'ok' runs.
ALTER TABLE public.message_log
  ADD COLUMN IF NOT EXISTS error_message text;

-- Widen the status check constraint to accept 'ok' (cron ran fine) and 'error' (cron failed).
-- Existing values ('sent', 'failed', 'skipped', 'scheduled', 'canceled') stay valid for email rows.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.message_log'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.message_log DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.message_log
  ADD CONSTRAINT message_log_status_check
  CHECK (status IN ('sent', 'failed', 'skipped', 'scheduled', 'canceled', 'ok', 'error'));

COMMIT;

NOTIFY pgrst, 'reload schema';
