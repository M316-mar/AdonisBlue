-- ============================================================================
-- 2026-10-14 Schema fixes
-- Safe to re-run: uses IF NOT EXISTS / IF EXISTS throughout.
-- Run in the Supabase SQL editor (not via CLI — we don't use supabase db push).
-- ============================================================================

BEGIN;

-- ── 0. bots.stripe_subscription_id ──────────────────────────────────────────
-- Critical: without this the entire checkout.session.completed upsert fails,
-- so stripe_customer_id, plan, and subscription_status are never saved either.
ALTER TABLE bots ADD COLUMN IF NOT EXISTS stripe_subscription_id text;

-- ── 1. checkin_reminders ─────────────────────────────────────────────────────
-- nurse_id is text to match treatments.nurse_id (format=text in OpenAPI spec).
CREATE TABLE IF NOT EXISTS checkin_reminders (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nurse_id     text        NOT NULL,
  intake_id    uuid        REFERENCES intakes(id) ON DELETE SET NULL,
  treatment_id uuid        REFERENCES treatments(id) ON DELETE CASCADE,
  due_date     date        NOT NULL,
  status       text        NOT NULL DEFAULT 'pending',
  note         text,
  completed_at timestamptz,
  updated_at   timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checkin_reminders_nurse_due
  ON checkin_reminders(nurse_id, due_date);

GRANT ALL ON checkin_reminders TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON checkin_reminders TO authenticated;

ALTER TABLE checkin_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS checkin_reminders_nurse_all ON checkin_reminders;
CREATE POLICY checkin_reminders_nurse_all ON checkin_reminders
  FOR ALL TO authenticated
  USING  (nurse_id = auth.uid()::text)
  WITH CHECK (nurse_id = auth.uid()::text);

-- ── 2. blueroom_post_reactions ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blueroom_post_reactions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid        NOT NULL REFERENCES blueroom_posts(id) ON DELETE CASCADE,
  nurse_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction   text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, nurse_id)
);

CREATE INDEX IF NOT EXISTS blueroom_post_reactions_post
  ON blueroom_post_reactions(post_id);

GRANT ALL ON blueroom_post_reactions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON blueroom_post_reactions TO authenticated;

ALTER TABLE blueroom_post_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blueroom_post_reactions_read  ON blueroom_post_reactions;
DROP POLICY IF EXISTS blueroom_post_reactions_write ON blueroom_post_reactions;
CREATE POLICY blueroom_post_reactions_read ON blueroom_post_reactions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY blueroom_post_reactions_write ON blueroom_post_reactions
  FOR ALL TO authenticated
  USING  (nurse_id = auth.uid())
  WITH CHECK (nurse_id = auth.uid());

-- ── 3. blueroom_notifications ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blueroom_notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nurse_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text        NOT NULL,
  post_id    uuid        REFERENCES blueroom_posts(id) ON DELETE CASCADE,
  post_title text,
  actor_name text,
  is_read    boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS blueroom_notifications_nurse_unread
  ON blueroom_notifications(nurse_id, is_read);

GRANT ALL ON blueroom_notifications TO service_role;
GRANT SELECT, UPDATE ON blueroom_notifications TO authenticated;

ALTER TABLE blueroom_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blueroom_notifications_own ON blueroom_notifications;
CREATE POLICY blueroom_notifications_own ON blueroom_notifications
  FOR ALL TO authenticated
  USING  (nurse_id = auth.uid())
  WITH CHECK (nurse_id = auth.uid());

-- ── 4. blueroom_post_views ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blueroom_post_views (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid        NOT NULL REFERENCES blueroom_posts(id) ON DELETE CASCADE,
  nurse_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, nurse_id)
);

CREATE INDEX IF NOT EXISTS blueroom_post_views_post
  ON blueroom_post_views(post_id);

GRANT ALL ON blueroom_post_views TO service_role;
GRANT SELECT, INSERT ON blueroom_post_views TO authenticated;

ALTER TABLE blueroom_post_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blueroom_post_views_read   ON blueroom_post_views;
DROP POLICY IF EXISTS blueroom_post_views_insert ON blueroom_post_views;
CREATE POLICY blueroom_post_views_read ON blueroom_post_views
  FOR SELECT TO authenticated USING (true);
CREATE POLICY blueroom_post_views_insert ON blueroom_post_views
  FOR INSERT TO authenticated WITH CHECK (nurse_id = auth.uid());

-- ── 5. blueroom_posts.is_pinned ──────────────────────────────────────────────
ALTER TABLE blueroom_posts ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false;

-- ── 6. beta_applications ─────────────────────────────────────────────────────
ALTER TABLE beta_applications ADD COLUMN IF NOT EXISTS phone_number      text;
ALTER TABLE beta_applications ADD COLUMN IF NOT EXISTS preferred_contact text;

-- ── 7. Backfill checkin_reminders for existing active treatments ─────────────
-- Only inserts rows where due date is today or later (no stale "overdue" flood).
-- Skips treatments whose nurse_id has no matching auth.users row (deleted nurses).
-- Status is always 'pending' — the only status the app scheduler/UI handles.
INSERT INTO checkin_reminders (nurse_id, intake_id, treatment_id, due_date, status)
SELECT
  t.nurse_id,
  t.intake_id,
  t.id                                                         AS treatment_id,
  (t.treatment_date::date + INTERVAL '14 days')::date         AS due_date,
  'pending'                                                    AS status
FROM treatments t
WHERE t.archived IS NOT TRUE
  AND t.treatment_date IS NOT NULL
  AND (t.treatment_date::date + INTERVAL '14 days')::date >= CURRENT_DATE
  AND EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id::text = t.nurse_id
  )
  AND NOT EXISTS (
    SELECT 1 FROM checkin_reminders cr WHERE cr.treatment_id = t.id
  );

COMMIT;

-- PostgREST must reload its schema cache to see the new tables/columns.
-- Run this after COMMIT (it cannot be inside a transaction block).
NOTIFY pgrst, 'reload schema';
