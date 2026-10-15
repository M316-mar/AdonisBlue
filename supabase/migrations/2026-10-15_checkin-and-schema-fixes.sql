-- 2026-10-15: Add checkin columns to procedures; no other schema changes needed
-- (blueroom_posts.nurse_id, referrals.nurse_id, and admins fixes are code-only)
-- Re-runnable: IF NOT EXISTS guards on columns.

BEGIN;

-- procedures.checkin_days: how many days after treatment to schedule the check-in reminder
-- fallback in code is 14 days when null
ALTER TABLE procedures
  ADD COLUMN IF NOT EXISTS checkin_days INTEGER;

-- procedures.checkin_script: custom check-in message template for this procedure
-- fallback in code is the generic AI-generated script when null
ALTER TABLE procedures
  ADD COLUMN IF NOT EXISTS checkin_script TEXT;

COMMIT;

NOTIFY pgrst, 'reload schema';
