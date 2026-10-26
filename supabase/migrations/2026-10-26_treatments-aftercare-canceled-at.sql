BEGIN;

ALTER TABLE treatments
  ADD COLUMN IF NOT EXISTS aftercare_canceled_at timestamptz;

COMMIT;
NOTIFY pgrst, 'reload schema';
