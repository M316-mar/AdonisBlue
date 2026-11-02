BEGIN;

DROP POLICY IF EXISTS "Public can read launched bots" ON public.bots;
DROP POLICY IF EXISTS "Public read posts" ON public.blueroom_posts;
DROP POLICY IF EXISTS "Public read comments" ON public.blueroom_comments;
DROP POLICY IF EXISTS "Allow public inserts" ON public.beta_applications;

REVOKE ALL ON public.bots FROM anon;
REVOKE ALL ON public.blueroom_posts FROM anon;
REVOKE ALL ON public.blueroom_comments FROM anon;
REVOKE ALL ON public.beta_applications FROM anon;

COMMIT;
NOTIFY pgrst, 'reload schema';
