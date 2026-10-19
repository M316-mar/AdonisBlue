-- Add business_hours and phone_public to bots.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS.

BEGIN;

ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS business_hours  TEXT,
  ADD COLUMN IF NOT EXISTS phone_public    TEXT;

COMMIT;

NOTIFY pgrst, 'reload schema';
