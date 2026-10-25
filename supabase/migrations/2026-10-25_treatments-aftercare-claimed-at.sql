BEGIN;

-- ── 1. Add claim column for idempotent cron sends ────────────────────────────
-- Set atomically before sending; cleared on success or failure.
-- A claim older than 10 minutes is stale and can be re-claimed by the next run.
ALTER TABLE treatments
  ADD COLUMN IF NOT EXISTS aftercare_claimed_at timestamptz;

-- ── 2. Fix message_log.status CHECK constraint ───────────────────────────────
-- The original constraint only allowed: sent, failed, skipped.
-- This silently blocked "scheduled" (scheduleEmail) and "canceled" (cancel routes)
-- since the table was created. Drop by searching pg_constraint (name may vary),
-- then recreate with the full value set.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.message_log'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE message_log DROP CONSTRAINT %I', r.conname);
  END LOOP;
END;
$$;

ALTER TABLE message_log
  ADD CONSTRAINT message_log_status_check
  CHECK (status IN ('sent', 'failed', 'skipped', 'scheduled', 'canceled'));

COMMIT;

NOTIFY pgrst, 'reload schema';
