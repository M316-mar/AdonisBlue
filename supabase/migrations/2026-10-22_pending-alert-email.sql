-- Add pending_alert_email column to bots.
-- Holds a newly entered alert email while the nurse is verifying it.
-- Emergency alerts always use alert_email (the verified one) until the
-- nurse clicks "Yes, I got it" in the verification email — never the pending address.
-- The verify-alert route promotes pending_alert_email → alert_email on confirmation.

BEGIN;

ALTER TABLE bots ADD COLUMN IF NOT EXISTS pending_alert_email text;

COMMIT;

NOTIFY pgrst, 'reload schema';
