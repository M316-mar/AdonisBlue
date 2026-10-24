BEGIN;

-- Stores the Resend email id returned at schedule time so aftercare-cancel
-- can call resend.emails.cancel() without relying on message_log.
-- Cleared to NULL when cancel succeeds or when aftercare is promoted to sent.
ALTER TABLE treatments
  ADD COLUMN IF NOT EXISTS aftercare_provider_id text;

COMMIT;

NOTIFY pgrst, 'reload schema';
