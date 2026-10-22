BEGIN;

-- Scheduled delivery time set when a treatment is logged (now + 60 min).
-- Cleared when the nurse hits Cancel. Left set after delivery (display anchor).
-- Promotion rule: when aftercare_send_at <= now() AND aftercare_sent_at IS NULL,
-- Resend has delivered — run promoteScheduledAftercares() to set aftercare_sent_at.
ALTER TABLE treatments
  ADD COLUMN IF NOT EXISTS aftercare_send_at TIMESTAMPTZ;

-- UTC delivery time passed to Resend scheduledAt. NULL for immediate sends.
ALTER TABLE message_log
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

COMMIT;

NOTIFY pgrst, 'reload schema';
