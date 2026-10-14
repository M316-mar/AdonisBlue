-- app_errors: structured error log for server-side failures
-- service_role only (no authenticated policy) — nurses never read this directly.
-- Re-runnable: IF NOT EXISTS throughout.

BEGIN;

CREATE TABLE IF NOT EXISTS app_errors (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  area       text        NOT NULL,  -- e.g. "stripe-webhook", "send-aftercare", "cron:reviews"
  nurse_id   text,                  -- text to match treatments.nurse_id (may be null for cron errors)
  message    text        NOT NULL
);

GRANT ALL ON app_errors TO service_role;
-- authenticated users get nothing — errors are internal only
ALTER TABLE app_errors ENABLE ROW LEVEL SECURITY;
-- No CREATE POLICY: service_role bypasses RLS; authenticated sees zero rows

COMMIT;
NOTIFY pgrst, 'reload schema';
