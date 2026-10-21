-- Add next_appointment_at / next_appointment_procedures columns to treatments,
-- then migrate the 3 fake "Rebooked appointment" rows into real treatments.
--
-- Re-runnable:
--   - ADD COLUMN IF NOT EXISTS is idempotent
--   - The UPDATE only touches real treatments where next_appointment_at IS NULL
--   - The archive UPDATE is idempotent (sets archived = true on already-archived rows)

BEGIN;

-- 1. New columns for rebook data (replaces the old pattern of a second treatment row).
ALTER TABLE treatments
  ADD COLUMN IF NOT EXISTS next_appointment_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_appointment_procedures TEXT;

-- 2. For each fake rebook row, copy its date + procedure name onto the most-recent
--    real treatment for the same client + procedure, then mark it as rebooked.
--    Uses COALESCE so existing rebooked_at/source are never overwritten.
WITH fake AS (
  SELECT id, intake_id, procedure_id, treatment_date, procedure_name
  FROM treatments
  WHERE (id::text LIKE '0c61da74%'
      OR id::text LIKE 'dd970e2a%'
      OR id::text LIKE 'ee4eef1d%')
    AND notes = 'Rebooked appointment'
),
best_real AS (
  SELECT DISTINCT ON (f.id)
    f.id             AS fake_id,
    t.id             AS real_id,
    f.treatment_date AS next_appt_at,
    f.procedure_name AS next_appt_procs
  FROM fake f
  JOIN treatments t
    ON  t.intake_id    = f.intake_id
    AND t.procedure_id = f.procedure_id
    AND t.id          != f.id
    AND (t.notes IS NULL OR t.notes != 'Rebooked appointment')
    AND t.archived     = false
  ORDER BY f.id, t.treatment_date DESC NULLS LAST
)
UPDATE treatments
SET
  next_appointment_at         = br.next_appt_at::TIMESTAMPTZ,
  next_appointment_procedures = br.next_appt_procs,
  rebooked_at                 = COALESCE(treatments.rebooked_at, NOW()),
  rebooked_source             = COALESCE(treatments.rebooked_source, 'at_visit')
FROM best_real br
WHERE treatments.id = br.real_id
  AND treatments.next_appointment_at IS NULL;

-- 3. Archive the fake rows so no cron fires for them.
--    Soft-delete is safer than hard-delete — verify the migration result first,
--    then delete manually once confirmed.
UPDATE treatments
SET archived = true
WHERE (id::text LIKE '0c61da74%'
    OR id::text LIKE 'dd970e2a%'
    OR id::text LIKE 'ee4eef1d%')
  AND notes = 'Rebooked appointment';

COMMIT;
NOTIFY pgrst, 'reload schema';
