-- Add alert_level and alert_messages to healing_chats so the dashboard can
-- show the highest urgency level per client and all flagged messages in order.
-- No new grants needed — existing table grants cover new columns.

BEGIN;

ALTER TABLE healing_chats
  ADD COLUMN IF NOT EXISTS alert_level  text
    CHECK (alert_level IN ('911', 'nurse')),
  ADD COLUMN IF NOT EXISTS alert_messages jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMIT;

NOTIFY pgrst, 'reload schema';
