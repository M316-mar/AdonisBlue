-- ── Migration: emergency_incident_feed ────────────────────────────────────────
-- Additive only — no existing columns touched, no data removed.

-- 1. conversations: add all flagged + incident tracking columns
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS flagged          boolean  NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS flagged_message  text,
  ADD COLUMN IF NOT EXISTS client_name      text,
  ADD COLUMN IF NOT EXISTS client_phone     text,
  ADD COLUMN IF NOT EXISTS status           text     NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS nurse_notes      text;

-- 2. healing_chats: add only what's missing (status + nurse_notes)
--    flagged, flagged_message, client_name, client_phone already exist
ALTER TABLE healing_chats
  ADD COLUMN IF NOT EXISTS status       text  NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS nurse_notes  text;

-- 3. Indexes for the incident feed query (both tables filter by nurse_id + flagged + status)
CREATE INDEX IF NOT EXISTS idx_conversations_emergency
  ON conversations (nurse_id, flagged, status);

CREATE INDEX IF NOT EXISTS idx_healing_chats_emergency
  ON healing_chats (nurse_id, flagged, status);
