BEGIN;

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key          text        NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer     NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rate_limits FROM anon, authenticated;
GRANT ALL ON public.rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text, p_max integer, p_window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window timestamptz;
  v_count  integer;
BEGIN
  IF p_window_seconds IS NULL OR p_window_seconds <= 0 THEN
    RETURN true;
  END IF;

  v_window := to_timestamp(
    floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.rate_limits (key, window_start, count)
  VALUES (p_key, v_window, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = public.rate_limits.count + 1
  RETURNING count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;

COMMIT;

SELECT cron.schedule(
  'cleanup-rate-limits',
  '17 9 * * *',
  $$DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day'$$
);

NOTIFY pgrst, 'reload schema';
