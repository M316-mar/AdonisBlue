BEGIN;

ALTER TABLE treatments
  ADD COLUMN IF NOT EXISTS rebooked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rebooked_source TEXT;

COMMIT;
NOTIFY pgrst, 'reload schema';
