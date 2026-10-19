-- Add alert contact + verification columns, nurse_name, and ready_at to bots.
-- Safe to re-run: all ADD COLUMN IF NOT EXISTS.

BEGIN;

ALTER TABLE bots
  ADD COLUMN IF NOT EXISTS alert_email               TEXT,
  ADD COLUMN IF NOT EXISTS alert_email_verified      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS alert_verification_token  TEXT,
  ADD COLUMN IF NOT EXISTS ready_at                  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nurse_name                TEXT;

-- Backfill alert_email from notification_email for nurses who already set one.
UPDATE bots
SET    alert_email = notification_email
WHERE  alert_email IS NULL
  AND  notification_email IS NOT NULL
  AND  notification_email <> '';

-- Backfill nurse_name from auth.users metadata (bots.nurse_id is uuid).
UPDATE bots b
SET    nurse_name = u.raw_user_meta_data->>'full_name'
FROM   auth.users u
WHERE  b.nurse_id = u.id
  AND  b.nurse_name IS NULL
  AND  u.raw_user_meta_data->>'full_name' IS NOT NULL;

-- Set ready_at for all already-launched nurses so the dashboard gate doesn't block them.
-- alert_email_verified stays false → dashboard can suggest verifying, non-blocking.
UPDATE bots
SET    ready_at = CURRENT_TIMESTAMP
WHERE  launched  = true
  AND  ready_at IS NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
