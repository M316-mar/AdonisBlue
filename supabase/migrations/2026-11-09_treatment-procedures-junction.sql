BEGIN;

CREATE TABLE IF NOT EXISTS public.treatment_procedures (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_id   uuid NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
  procedure_id   uuid NOT NULL REFERENCES public.procedures(id) ON DELETE RESTRICT,
  procedure_name text NOT NULL,
  sort_order     int  NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS treatment_procedures_treatment_procedure_key
  ON public.treatment_procedures (treatment_id, procedure_id);

CREATE INDEX IF NOT EXISTS treatment_procedures_treatment_id_idx
  ON public.treatment_procedures (treatment_id, sort_order);

ALTER TABLE public.treatment_procedures ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.treatment_procedures FROM anon;

DROP POLICY IF EXISTS "nurse own treatment procedures" ON public.treatment_procedures;
CREATE POLICY "nurse own treatment procedures"
  ON public.treatment_procedures
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.treatments t
    WHERE t.id = treatment_procedures.treatment_id
      AND t.nurse_id = auth.uid()::text
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.treatments t
    WHERE t.id = treatment_procedures.treatment_id
      AND t.nurse_id = auth.uid()::text
  ));

GRANT ALL ON public.treatment_procedures TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_procedures TO authenticated;

INSERT INTO public.treatment_procedures (treatment_id, procedure_id, procedure_name, sort_order)
SELECT t.id, t.procedure_id, p.name, 0
FROM public.treatments t
JOIN public.procedures p ON p.id = t.procedure_id
ON CONFLICT (treatment_id, procedure_id) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
