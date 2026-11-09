BEGIN;

-- Widen message_log.status to include 'pending' (used for action_needed to-dos)
ALTER TABLE public.message_log
  DROP CONSTRAINT IF EXISTS message_log_status_check;

ALTER TABLE public.message_log
  ADD CONSTRAINT message_log_status_check
  CHECK (status IN ('sent', 'failed', 'skipped', 'scheduled', 'canceled', 'ok', 'error', 'pending'));

COMMIT;

NOTIFY pgrst, 'reload schema';
