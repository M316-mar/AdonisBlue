BEGIN;

ALTER TABLE bots ADD COLUMN IF NOT EXISTS rebooking_link text;

COMMIT;
NOTIFY pgrst, 'reload schema';
