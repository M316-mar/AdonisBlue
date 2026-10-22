BEGIN;

-- Track when the nurse marked each alert handled (for history display).
-- Status (active/resolved/accidental) remains the source of truth for visibility.
ALTER TABLE healing_chats  ADD COLUMN IF NOT EXISTS handled_at TIMESTAMPTZ;
ALTER TABLE conversations  ADD COLUMN IF NOT EXISTS handled_at TIMESTAMPTZ;

COMMIT;
NOTIFY pgrst, 'reload schema';
