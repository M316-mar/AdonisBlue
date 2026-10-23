-- Add unique constraint on healing_chats.treatment_id so that
-- upsert with onConflict:"treatment_id" works correctly.
-- Without this constraint the upsert silently inserts duplicates (or fails
-- depending on Supabase version) instead of updating the existing row.
BEGIN;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'healing_chats'::regclass
    AND contype = 'u'
    AND conname = 'healing_chats_treatment_id_key'
  ) THEN
    ALTER TABLE healing_chats ADD CONSTRAINT healing_chats_treatment_id_key UNIQUE (treatment_id);
  END IF;
END $$;

COMMIT;
NOTIFY pgrst, 'reload schema';
