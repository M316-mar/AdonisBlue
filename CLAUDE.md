@AGENTS.md

## Who we serve
The solo nurse injector who chooses to work for herself. She handles the front (attracting and treating clients). AdonisBlue handles the back: after the visit, every client feels seen, and remembers to come back for touch-ups and return visits.

## How we build
We build what is needed, not what is trendy. Even if other tools have a feature, we deliver it more reliably and with better care. Fewer features, done really well.

Before building anything, ask: does this help her clients feel cared for after the visit, or help them come back? If not, don't build it.

## Phone-first

Nurses use phone, then iPad, then laptop. Every UI change must pass device-check at 390px, 820px, and 1440px before pushing. `scripts/device-check.mjs` runs as part of `npm run check`. **Never weaken device-check to make a change pass — tell Valentina instead.**

## Security rules

These 8 rules are enforced by `scripts/security-check.mjs`, which runs as part of `npm run check`. **After every change, run `npm run check`. Never push if it fails. Never weaken this script to make a change pass — tell Valentina instead.**

1. **Route auth** — every `app/api/**/route.ts` must either check the user's auth token, call `requireAdmin`, check `CRON_SECRET`, check `INTERNAL_SECRET`, or appear in the `PUBLIC_ROUTES` allowlist in `scripts/security-check.mjs` with a one-line reason. Adding a new public route requires adding it to that list on purpose.
2. **Trust boundary** — public routes must not read `nurse_id` or `bot_id` from the request body/query and use them for DB writes or emails. Resolve them server-side from a slug, token, or DB lookup instead.
3. **No NEXT_PUBLIC_ secrets** — `NEXT_PUBLIC_` variable names must not contain KEY, SECRET, TOKEN, or SERVICE (except the allowed Supabase/Stripe vars). No hardcoded key patterns (`sk_live_`, `sk_test_`, `rk_`, `whsec_`, `re_`, service-role JWTs) in source code.
4. **No service-role key in client code** — `"use client"` files must not import or reference `SUPABASE_SERVICE_ROLE_KEY`.
5. **No `dangerouslySetInnerHTML`** — use plain text or a sanitized component instead.
6. **Migration safety** — any new migration that runs `CREATE TABLE` must include `ENABLE ROW LEVEL SECURITY`. Any `GRANT ... TO anon` requires a `-- anon justified:` comment explaining why public read is necessary.
7. **Bot field allowlist** — `/api/bot/[slug]` must only return fields in its `PUBLIC_BOT_FIELDS` constant. Private fields (`nurse_id`, `id`, `notification_email`, `alert_*`, `stripe_*`, etc.) must never be included.
8. **Dependency audit** — `npm audit --omit=dev` must report zero high or critical vulnerabilities.
9. **Never print credentials** — never echo, repeat, or log any password, key, or secret in chat, logs, reports, or commits, even if asked to "show" it. Show only the email address or the variable name.
10. **TEST_NURSE_EMAIL must not be an admin email** — it must never match any address in `ADMIN_EMAILS`. `scripts/device-check.mjs` must refuse to run logged-in checks if it is, and exit with an error.

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
- **`/api/booking-webhook` is disabled** (returns 410). Re-enable only when a nurse actually needs it and per-nurse webhook secret verification (not a shared URL secret) is implemented. See the comment at the top of the route handler.
- **Internal-only routes** (e.g. `/api/extract-intake`) require `Authorization: Bearer <INTERNAL_SECRET>` and must never be called from the browser. Server callers pass the header; the route rejects anything without it with 401. If `INTERNAL_SECRET` is unset on the server, the route must fail closed (500) and call `logError`.
- **CI never gets the service role key.** The GitHub Actions workflow uses `npm run check:ci`, which skips `schema-check.mjs` (the only script that needs the key). All other build, test, and security checks still run in CI.
- Before every push: run `npm run check` (build + schema-check) and show the raw output. Then `git status` (no untracked files), commit, push, `git show --stat`.
- **Never push code that reads or writes a new column/table until the user confirms the migration ran.** Commit is fine; push must wait.
- **Calendar dates ("today", treatment dates, due dates) always use `lib/localDate.ts` / shared date helpers — never `new Date().toISOString().slice(0, 10)` for a calendar date.** That returns the UTC date; at 22:00 Chicago it gives tomorrow.
- Background work on Vercel uses `after()` from `next/server`, never fire-and-forget promises.
- All client emails/SMS go through `lib/sendAndLog.ts`.
- No false or unverifiable claims in any client- or nurse-facing text.
- Keep the UI simple enough to use without a tutorial. Plain language.
## Removed features

These features were removed from the codebase on 2026-10-30 to narrow the product to Core 4 + Offers. The git tag `before-simplify` marks the state before removal — use it to restore any of these.

**Removed:** Loyalty points, Blue Room community, Instagram automation (pages + API routes only — no backend existed), Insights dashboard, Newsletter signup/unsubscribe.

**DB tables still exist** (`blueroom_posts`, `blueroom_comments`, `blueroom_comment_reactions`, `blueroom_post_reactions`, `blueroom_post_views`, `blueroom_notifications`, `loyalty_points`, `loyalty_programs`). The delete-account and delete-nurse routes still erase these tables' data for any deleted user.
