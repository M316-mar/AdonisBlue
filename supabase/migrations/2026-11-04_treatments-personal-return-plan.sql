BEGIN;

ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS planned_return_at        date,
  ADD COLUMN IF NOT EXISTS return_reason            text,
  ADD COLUMN IF NOT EXISTS reminder_lead_days       integer,
  ADD COLUMN IF NOT EXISTS planned_reminder_sent_at timestamptz;

ALTER TABLE public.treatments DROP CONSTRAINT IF EXISTS chk_reminder_lead_days;
ALTER TABLE public.treatments ADD CONSTRAINT chk_reminder_lead_days
  CHECK (reminder_lead_days IS NULL OR reminder_lead_days IN (0, 3, 7, 14));

ALTER TABLE public.treatments DROP CONSTRAINT IF EXISTS chk_return_reason_len;
ALTER TABLE public.treatments ADD CONSTRAINT chk_return_reason_len
  CHECK (return_reason IS NULL OR char_length(return_reason) <= 120);

ALTER TABLE public.treatments DROP CONSTRAINT IF EXISTS chk_return_plan_complete;
ALTER TABLE public.treatments ADD CONSTRAINT chk_return_plan_complete
  CHECK ((planned_return_at IS NULL) = (reminder_lead_days IS NULL));

COMMIT;

NOTIFY pgrst, 'reload schema';
