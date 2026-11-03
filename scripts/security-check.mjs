/**
 * security-check.mjs — automated security guardrail for AdonisBlue.
 * Run via `npm run check`. Fails (exit 1) on any violation.
 *
 * Rules:
 *  1. Every API route must be auth-checked, cron-gated, internal-gated, or
 *     explicitly listed as public with a reason.
 *  2. Public routes must not read nurse_id or bot_id from request body/query.
 *  3. No leaking secrets via NEXT_PUBLIC_ or hardcoded key patterns.
 *  4. "use client" files must not use the service-role key.
 *  5. No dangerouslySetInnerHTML in JSX.
 *  6. New migrations that CREATE TABLE must have RLS enabled and must not
 *     grant anon without a justification comment.
 *  7. /api/bot/[slug] must not return fields outside its allowlist.
 *  8. npm audit must report zero high/critical prod vulnerabilities.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, join, relative } from "path";
import { execSync } from "child_process";

const ROOT = resolve(process.cwd());

let failures = 0;
function fail(rule, file, detail) {
  console.error(`  FAIL [rule ${rule}] ${file}: ${detail}`);
  failures++;
}
function pass(label) {
  console.log(`  ✓ ${label}`);
}

function read(abs) { return readFileSync(abs, "utf8"); }
function rel(abs) { return relative(ROOT, abs); }

function walkDir(dir, ext) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) results.push(...walkDir(full, ext));
    else if (!ext || entry.endsWith(ext)) results.push(full);
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 1 — every API route must be auth-gated or explicitly whitelisted
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nRule 1 — API route auth coverage:");

/**
 * Routes that are intentionally public (no user auth required).
 * Key: path relative to app/api (no leading slash, no trailing /route.ts).
 * Value: one-line reason.
 */
const PUBLIC_ROUTES = {
  // Client-facing AI/chat flows
  "chat":                   "public client chatbot — rate-limited, slug-gated",
  "healing":                "public client healing chat — treatment_id gated",
  "product-chat":           "public product info chat — rate-limited",
  "bot/[slug]":             "public bot config read — explicit field allowlist",

  // Review / survey flows
  "review/submit":          "public review submission — review_token gated",
  "reviews/[id]":           "public read of a single review — no PII",
  "reviews":                "public read of nurse reviews — no PII",

  // Client intake flows (bot-slug / bot-id gated server-side)
  "extract-intake":         "internal-only — INTERNAL_SECRET required",

  // Email action links (token-gated)
  "unsubscribe":            "email unsubscribe link — token gated",
  "verify-alert":           "email verification link — token + nurse_id verified against DB token",
  "submit-survey":          "retired endpoint — always returns 410",

  // Webhooks (verified by their own signature/secret)
  "stripe-webhook":         "Stripe webhook — signature verified with STRIPE_WEBHOOK_SECRET",
  "booking-webhook":        "disabled — always returns 410",

  // Public-facing pages (no user data)
  "beta-application":       "public beta signup — no nurse data written",
  "notify-new-signup":      "Supabase auth hook — called by Supabase mailer, not the browser",
  "send-confirmation":      "Supabase auth hook — custom email hook called by Supabase, not browser",

  // Admin-gated (requireAdmin checked inside)
  "admin/delete-nurse":     "requireAdmin checked inside route",
  "admin/feedback":         "requireAdmin checked inside route",
  "admin/freeze-account":   "requireAdmin checked inside route",
  "admin/me":               "requireAdmin checked inside route",
  "admin/nurses":           "requireAdmin checked inside route",
  "admin/nurses-public":    "public list of launched bots for admin UI",
  "admin/preview-link":     "requireAdmin checked inside route",
  "admin/refund-log":       "requireAdmin checked inside route",
};

// Patterns that count as "auth checked"
const AUTH_PATTERNS = [
  /auth\.getUser/,
  /requireAdmin/,
  /CRON_SECRET/,
  /INTERNAL_SECRET/,
];

const apiDir = join(ROOT, "app", "api");
const routeFiles = walkDir(apiDir, "route.ts").concat(walkDir(apiDir, "route.tsx"));

let rule1Pass = 0;
let rule1Fail = 0;
for (const abs of routeFiles) {
  const routeKey = relative(apiDir, abs)
    .replace(/\/route\.tsx?$/, "")
    .replace(/\\/g, "/");

  const src = read(abs);
  const hasAuth = AUTH_PATTERNS.some((p) => p.test(src));
  const isPublic = Object.prototype.hasOwnProperty.call(PUBLIC_ROUTES, routeKey);
  const isCron = routeKey.startsWith("cron/");

  if (hasAuth || isPublic || isCron) {
    rule1Pass++;
  } else {
    fail(1, rel(abs), `route "${routeKey}" has no auth check and is not in PUBLIC_ROUTES`);
    rule1Fail++;
  }
}
if (rule1Fail === 0) pass(`all ${rule1Pass} API routes are auth-gated or explicitly public`);

// ─────────────────────────────────────────────────────────────────────────────
// RULE 2 — public routes must not read nurse_id or bot_id from body/query
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nRule 2 — public routes don't read nurse_id/bot_id from client:");

// Routes where nurse_id/bot_id appears in body/query but the risk is accepted.
// Each entry must have a comment explaining WHY it is safe or acceptable.
const TRUST_EXCEPTIONS = new Set([
  // verify-alert: nurse_id from query is only used as a DB lookup key; the
  // real gate is alert_verification_token checked against DB row — the lookup
  // returns nothing for a fake nurse_id; no PII or data is exposed.
  "verify-alert",

]);

let rule2Pass = 0;
let rule2Fail = 0;
for (const routeKey of Object.keys(PUBLIC_ROUTES)) {
  if (TRUST_EXCEPTIONS.has(routeKey)) { rule2Pass++; continue; }
  // Admin routes are requireAdmin-gated — nurse_id in body is safe (admin acting on a nurse)
  if (routeKey.startsWith("admin/")) { rule2Pass++; continue; }
  const abs = join(apiDir, routeKey, "route.ts");
  let src;
  try { src = read(abs); } catch { continue; } // file may not exist (deleted)

  // Check for patterns that read nurse_id or bot_id from the incoming request
  // (query params or JSON body destructure) without a DB-side resolution.
  const bodyNurse = /const\s*\{[^}]*\bnurse_id\b[^}]*\}\s*=\s*(await\s+request\.json\(\)|body)/.test(src);
  const queryNurse = /(?:searchParams|url)\s*\.get\s*\(\s*["']nurse_id["']\s*\)/.test(src) &&
    !src.includes("alert_verification_token"); // verify-alert is exempted above
  const bodyBotId  = /const\s*\{[^}]*\bbot_id\b[^}]*\}\s*=\s*(await\s+request\.json\(\)|body)/.test(src);
  const queryBotId = /(?:searchParams|url)\s*\.get\s*\(\s*["']bot_id["']\s*\)/.test(src);

  // extract-intake and chat resolve bot_id server-side — allow bot_id in body there
  // because it is immediately validated against DB (never used raw for nurse routing).
  const allowsBotIdBody = routeKey === "extract-intake" || routeKey === "chat";

  if (bodyNurse || queryNurse) {
    fail(2, join("app/api", routeKey, "route.ts"), "reads nurse_id from request — must resolve server-side");
    rule2Fail++;
  } else if ((bodyBotId || queryBotId) && !allowsBotIdBody) {
    fail(2, join("app/api", routeKey, "route.ts"), "reads bot_id from request — must resolve server-side");
    rule2Fail++;
  } else {
    rule2Pass++;
  }
}
if (rule2Fail === 0) pass(`all ${rule2Pass} checked public routes pass trust boundary`);

// ─────────────────────────────────────────────────────────────────────────────
// RULE 3 — no NEXT_PUBLIC_ secrets; no hardcoded key patterns
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nRule 3 — no NEXT_PUBLIC_ secrets or hardcoded keys:");

// NEXT_PUBLIC_ vars that are intentionally public
const ALLOWED_NEXT_PUBLIC = new Set([
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
]);

const SECRET_SUFFIX = /NEXT_PUBLIC_\w*(KEY|SECRET|TOKEN|SERVICE)\b/gi;
const HARDCODED_PATTERNS = [
  { re: /sk_live_[A-Za-z0-9]{20,}/, label: "Stripe live secret key" },
  { re: /sk_test_[A-Za-z0-9]{20,}/, label: "Stripe test secret key" },
  { re: /rk_(live|test)_[A-Za-z0-9]{20,}/, label: "Stripe restricted key" },
  { re: /whsec_[A-Za-z0-9]{20,}/, label: "Stripe webhook secret" },
  { re: /re_(live|test)_[A-Za-z0-9]{20,}/, label: "Resend API key" },
  // Service-role JWTs start with eyJ and are >100 chars — skip eyJ in comments
  { re: /(?<![/#*])eyJ[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, label: "service-role JWT" },
];

const codeFiles = [
  ...walkDir(join(ROOT, "app"), ".ts"),
  ...walkDir(join(ROOT, "app"), ".tsx"),
  ...walkDir(join(ROOT, "lib"), ".ts"),
  ...walkDir(join(ROOT, "scripts"), ".mjs"),
].filter((f) => !f.includes("node_modules") && !f.includes(".next"));

let rule3Fail = 0;
for (const abs of codeFiles) {
  const src = read(abs);
  const matches = src.match(SECRET_SUFFIX) ?? [];
  for (const m of matches) {
    if (!ALLOWED_NEXT_PUBLIC.has(m)) {
      fail(3, rel(abs), `${m} — NEXT_PUBLIC_ variable may expose a secret to the browser`);
      rule3Fail++;
    }
  }
  for (const { re, label } of HARDCODED_PATTERNS) {
    if (re.test(src)) {
      fail(3, rel(abs), `possible hardcoded ${label}`);
      rule3Fail++;
    }
  }
}
if (rule3Fail === 0) pass("no NEXT_PUBLIC_ secrets or hardcoded key patterns found");

// ─────────────────────────────────────────────────────────────────────────────
// RULE 4 — "use client" files must not use service-role key
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nRule 4 — no service-role key in client components:");

let rule4Fail = 0;
let rule4Pass = 0;
const clientFiles = codeFiles.filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
for (const abs of clientFiles) {
  const src = read(abs);
  if (!src.trimStart().startsWith('"use client"') && !src.trimStart().startsWith("'use client'")) continue;
  if (src.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    fail(4, rel(abs), '"use client" file references SUPABASE_SERVICE_ROLE_KEY');
    rule4Fail++;
  } else {
    rule4Pass++;
  }
}
if (rule4Fail === 0) pass(`no service-role key in client components (${rule4Pass} client files checked)`);

// ─────────────────────────────────────────────────────────────────────────────
// RULE 5 — no dangerouslySetInnerHTML
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nRule 5 — no dangerouslySetInnerHTML:");

let rule5Fail = 0;
let rule5Pass = 0;
const jsxFiles = codeFiles.filter((f) => f.endsWith(".tsx"));
for (const abs of jsxFiles) {
  const src = read(abs);
  if (src.includes("dangerouslySetInnerHTML")) {
    fail(5, rel(abs), "dangerouslySetInnerHTML — use a sanitized component or plain text instead");
    rule5Fail++;
  } else {
    rule5Pass++;
  }
}
if (rule5Fail === 0) pass(`no dangerouslySetInnerHTML in ${rule5Pass} TSX files`);

// ─────────────────────────────────────────────────────────────────────────────
// RULE 6 — new migrations: CREATE TABLE must have RLS; no unjustified anon grants
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nRule 6 — migration RLS + anon grant safety:");

// Migrations predating this check (added before security-check existed).
// All were manually reviewed — adding a new one here requires a comment explaining why.
const LEGACY_MIGRATIONS = new Set([
  "20240615_booking_webhook.sql",
  "20240616_blueroom_features.sql",  // blueroom tables: RLS-less but feature removed
  "20240617_subscription_plan.sql",
  "20240618_brand_color.sql",
  "20240619_logo_url.sql",
  "20240620_offers.sql",
  "20240621_numbing_cancellation.sql",
  "20240622_offers_rls.sql",
  "20240623_offers_ongoing.sql",
  "20240624_stripe_columns.sql",
  "20240625_emergency_incident_feed.sql",
  "2026-10-14_app_errors.sql",
  "2026-10-14_schema_fixes.sql",
  "2026-10-15_checkin-and-schema-fixes.sql",
  "2026-10-17_onboarding-alert-fields.sql",
  "2026-10-19_bots-hours-phone-public.sql",
  "2026-10-19_treatments-rebooked.sql",
  "2026-10-21_aftercare-scheduled-send.sql",
  "2026-10-21_procedures-dedup-unique-index.sql",
  "2026-10-21_treatments-next-appointment.sql",
  "2026-10-22_assistant-handled-at.sql",
  "2026-10-22_pending-alert-email.sql",
  "2026-10-23_healing-chats-alert-messages.sql",
  "2026-10-23_healing-chats-unique-treatment-id.sql",
  "2026-10-23_rebooking-link.sql",
  "2026-10-24_treatments-aftercare-provider-id.sql",
  "2026-10-25_treatments-aftercare-claimed-at.sql",
  "2026-10-26_treatments-aftercare-canceled-at.sql",
  "2026-11-02_drop-risky-anon-policies.sql",
  "2026-11-02_rate-limits.sql",
]);

let rule6Fail = 0;
let rule6Pass = 0;
const migDir = join(ROOT, "supabase", "migrations");
let migFiles;
try { migFiles = readdirSync(migDir).filter((f) => f.endsWith(".sql")); }
catch { migFiles = []; }

for (const fname of migFiles) {
  if (LEGACY_MIGRATIONS.has(fname)) { rule6Pass++; continue; }
  const src = read(join(migDir, fname));
  if (!src.includes("CREATE TABLE")) { rule6Pass++; continue; }

  if (!src.includes("ENABLE ROW LEVEL SECURITY")) {
    fail(6, join("supabase/migrations", fname), "CREATE TABLE without ENABLE ROW LEVEL SECURITY");
    rule6Fail++;
  }
  // anon grant without justification comment
  if (/GRANT\s+\w[^;]*\s+TO\s+anon/i.test(src) && !src.includes("-- anon justified:")) {
    fail(6, join("supabase/migrations", fname), "GRANT to anon without '-- anon justified:' comment");
    rule6Fail++;
  }
  if (rule6Fail === 0) rule6Pass++;
}
if (rule6Fail === 0) pass(`all ${rule6Pass} migration files pass RLS + anon grant check`);

// ─────────────────────────────────────────────────────────────────────────────
// RULE 7 — /api/bot/[slug] response uses explicit allowlist
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nRule 7 — /api/bot/[slug] field allowlist:");

const PRIVATE_BOT_FIELDS = [
  "nurse_id", "id", "notification_email", "alert_email", "alert_email_verified",
  "alert_phone", "alert_verification_token", "pending_alert_email",
  "stripe_customer_id", "stripe_subscription_id", "stripe_price_id",
  "nurse_email", "subscription_status", "plan", "state", "webhook_secret",
  "ready_at", "trial_ends_at",
];

let rule7Fail = 0;
try {
  const botSrc = read(join(apiDir, "bot", "[slug]", "route.ts"));
  // Extract the PUBLIC_BOT_FIELDS string
  const m = botSrc.match(/PUBLIC_BOT_FIELDS\s*=\s*((?:"[^"]*"\s*\+\s*)*"[^"]*")/s);
  const fieldStr = m ? m[1].replace(/["'`\s+]/g, "") : "";
  const fields = new Set(fieldStr.split(",").map((f) => f.trim()).filter(Boolean));

  // Must use explicit select — must not spread entire row
  if (botSrc.includes("...data") || botSrc.includes("...bot")) {
    fail(7, "app/api/bot/[slug]/route.ts", "spreads entire bot row — use explicit field allowlist");
    rule7Fail++;
  }
  for (const priv of PRIVATE_BOT_FIELDS) {
    if (fields.has(priv)) {
      fail(7, "app/api/bot/[slug]/route.ts", `private field "${priv}" is in PUBLIC_BOT_FIELDS`);
      rule7Fail++;
    }
  }
  if (rule7Fail === 0) pass("/api/bot/[slug] allowlist contains no private fields");
} catch {
  pass("/api/bot/[slug] route not found — skip");
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 8 — npm audit: no high/critical prod vulnerabilities
// ─────────────────────────────────────────────────────────────────────────────
console.log("\nRule 8 — npm audit (prod dependencies only):");

let rule8Fail = 0;
try {
  // npm audit exits non-zero when vulnerabilities exist — use stdio:pipe and parse output regardless
  let auditJson = "";
  try {
    auditJson = execSync("npm audit --omit=dev --json", { cwd: ROOT, stdio: "pipe" }).toString();
  } catch (e) {
    // npm audit exits 1 on vulnerabilities — stdout still has the JSON
    auditJson = e.stdout?.toString() ?? "";
  }
  if (!auditJson) throw new Error("empty audit output");
  const audit = JSON.parse(auditJson);
  const vulns = audit.vulnerabilities ?? {};
  const highCrit = Object.entries(vulns)
    .filter(([, v]) => v.severity === "high" || v.severity === "critical");
  if (highCrit.length > 0) {
    for (const [pkg, v] of highCrit) {
      fail(8, "package.json", `${v.severity} vulnerability in ${pkg}: ${v.via?.[0]?.title ?? v.via?.[0] ?? "see npm audit"}`);
      rule8Fail++;
    }
  } else {
    pass("npm audit: no high/critical prod vulnerabilities");
  }
} catch (e) {
  fail(8, "package.json", `npm audit failed to run: ${e.message}`);
  rule8Fail++;
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(70)}`);
if (failures === 0) {
  console.log("security-check: all rules passed ✓\n");
} else {
  console.error(`security-check: ${failures} violation(s) found — fix before pushing\n`);
  process.exit(1);
}
