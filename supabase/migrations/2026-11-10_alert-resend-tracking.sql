-- Track how many re-send emails have gone out for each unhandled emergency.
-- alert_resend_count: 0 = only initial alert sent; 1 = one re-send; 2 = two re-sends (max).
-- alert_last_resent_at: timestamp of the most recent re-send (NULL until first re-send).

BEGIN;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS alert_resend_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alert_last_resent_at timestamptz;

ALTER TABLE healing_chats
  ADD COLUMN IF NOT EXISTS alert_resend_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alert_last_resent_at timestamptz;

COMMIT;

NOTIFY pgrst, 'reload schema';
