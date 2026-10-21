-- Deduplicate procedures by (nurse_id, name), then enforce uniqueness.
-- Re-runnable: the UPDATE and DELETE are no-ops when no duplicates exist;
-- the index creation uses IF NOT EXISTS.
--
-- Keeper selection priority (per nurse+name group):
--   1. Has approved_at IS NOT NULL
--   2. Referenced by the most treatments
--   3. Most recently created (tiebreaker)
--
-- treatments.procedure_id is repointed to the keeper before the loser is removed.

BEGIN;

-- Step 1: Repoint treatments from loser procedures to the keeper.
WITH treatment_refs AS (
  SELECT procedure_id, COUNT(*) AS ref_count
  FROM treatments
  WHERE procedure_id IS NOT NULL
  GROUP BY procedure_id
),
ranked AS (
  SELECT
    p.id,
    p.nurse_id,
    p.name,
    ROW_NUMBER() OVER (
      PARTITION BY p.nurse_id, p.name
      ORDER BY
        (p.approved_at IS NOT NULL) DESC,
        COALESCE(tr.ref_count, 0) DESC,
        p.created_at DESC
    ) AS rn
  FROM procedures p
  LEFT JOIN treatment_refs tr ON tr.procedure_id = p.id
),
keepers AS (
  SELECT id AS keeper_id, nurse_id, name FROM ranked WHERE rn = 1
),
losers AS (
  SELECT r.id AS loser_id, k.keeper_id
  FROM ranked r
  JOIN keepers k ON k.nurse_id = r.nurse_id AND k.name = r.name
  WHERE r.rn > 1
)
UPDATE treatments
SET procedure_id = l.keeper_id
FROM losers l
WHERE treatments.procedure_id = l.loser_id;

-- Step 2: Delete the loser rows.
WITH treatment_refs AS (
  SELECT procedure_id, COUNT(*) AS ref_count
  FROM treatments
  WHERE procedure_id IS NOT NULL
  GROUP BY procedure_id
),
ranked AS (
  SELECT
    p.id,
    ROW_NUMBER() OVER (
      PARTITION BY p.nurse_id, p.name
      ORDER BY
        (p.approved_at IS NOT NULL) DESC,
        COALESCE(tr.ref_count, 0) DESC,
        p.created_at DESC
    ) AS rn
  FROM procedures p
  LEFT JOIN treatment_refs tr ON tr.procedure_id = p.id
)
DELETE FROM procedures
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 3: Unique index — safe now that duplicates are gone.
CREATE UNIQUE INDEX IF NOT EXISTS procedures_nurse_id_name_idx
  ON procedures (nurse_id, name);

COMMIT;
NOTIFY pgrst, 'reload schema';
