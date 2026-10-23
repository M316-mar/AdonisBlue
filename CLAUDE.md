@AGENTS.md

## What AdonisBlue must always deliver (in priority order)
1. SAFETY — emergency alerts always reach the nurse. Never let any change risk this.
2. CARE — aftercare email + 24h check-in go out after every logged treatment.
3. RETURN — each client is reminded to come back at the right time for her treatment, and the nurse sees who's due back soon so she can keep a slot open.
4. EASY SETUP — a new nurse gets to 1–3 without help or a tutorial.
Everything else (Instagram automation, Blue Room, offers, newsletter) is secondary: no new work on it until 1–4 are solid, and never let it break 1–4.

## Data conventions

- **`treatments.aftercare_sent_at` is the source of truth** for whether aftercare was sent (never the boolean `aftercare_sent` alone). All reads (UI badges, cron filters, insights counts, secretary context) check `aftercare_sent_at IS NOT NULL`. Writes must always set both `aftercare_sent = true` AND `aftercare_sent_at = <timestamp>` together so the boolean stays consistent for any future query that still uses it.

## Engineering rules

- Every Supabase call must check `error`. Never swallow errors in an empty `try/catch` — log them with `logError()` from `lib/logError.ts`. No client message text in the log message.
- **Never execute SQL directly** (no browser SQL editor, no psql, no supabase CLI). Always show the SQL and wait for the user to run it.
- Any DB schema change = a new file in `supabase/migrations/YYYY-MM-DD_name.sql` (re-runnable: `IF NOT EXISTS`, `DROP POLICY IF EXISTS`), git-added before the commit, ending with `NOTIFY pgrst, 'reload schema';` after `COMMIT`.
- Every `CREATE TABLE` migration must include all grants in the same file (Supabase no longer auto-grants on new tables as of 2026-10-30):
  - `GRANT ALL ON <table> TO service_role;` — always required.
  - `GRANT SELECT, INSERT, UPDATE, DELETE ON <table> TO authenticated;` — required if nurses access the table, plus an RLS policy so nurses see only their own rows.
  - `GRANT SELECT ON <table> TO anon;` — only if a public, not-logged-in page truly needs to read it directly (add a comment explaining why). Never grant `anon` write access.
- Nurse IDs: some tables store `nurse_id` as `text`, some as `uuid`. Always check the actual column type (`information_schema` or the OpenAPI spec) and cast correctly (`auth.uid()::text` in RLS when the column is `text`).
- Before every push: run `npm run check` (build + schema-check) and show the raw output. Then `git status` (no untracked files), commit, push, `git show --stat`.
- **Never push code that reads or writes a new column/table until the user confirms the migration ran.** Commit is fine; push must wait.
- Background work on Vercel uses `after()` from `next/server`, never fire-and-forget promises.
- All client emails/SMS go through `lib/sendAndLog.ts`.
- No false or unverifiable claims in any client- or nurse-facing text.
- Keep the UI simple enough to use without a tutorial. Plain language.