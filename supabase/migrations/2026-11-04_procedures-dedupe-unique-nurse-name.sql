BEGIN;

CREATE TEMP TABLE proc_map ON COMMIT DROP AS
WITH ranked AS (
  SELECT p.id, p.nurse_id, p.name,
         ROW_NUMBER() OVER (
           PARTITION BY p.nurse_id, p.name
           ORDER BY (SELECT COUNT(*) FROM public.treatments t WHERE t.procedure_id = p.id) DESC, p.id
         ) AS rn
  FROM public.procedures p
)
SELECT d.id AS dup_id, k.id AS keep_id
FROM ranked d
JOIN ranked k
  ON k.nurse_id = d.nurse_id AND k.name = d.name AND k.rn = 1
WHERE d.rn > 1;

UPDATE public.treatments t
SET procedure_id = m.keep_id
FROM proc_map m
WHERE t.procedure_id = m.dup_id;

DELETE FROM public.procedures p
USING proc_map m
WHERE p.id = m.dup_id;

CREATE UNIQUE INDEX IF NOT EXISTS procedures_nurse_id_name_key
  ON public.procedures (nurse_id, name);

COMMIT;

NOTIFY pgrst, 'reload schema';
