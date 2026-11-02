/**
 * Tests that public routes do not trust nurse_id from the request body.
 * These are static/structural tests — they verify the source code enforces
 * the trust boundary without making live network calls.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    failed++;
  }
}

function readRoute(rel) {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

// ── /api/chat ──────────────────────────────────────────────────────────────
console.log("\n/api/chat nurse_id trust:");
{
  const src = readRoute("app/api/chat/route.ts");

  // Must resolve bot_slug from request body and look it up in DB
  assert(src.includes("bot_slug"), "reads bot_slug from botConfig");
  assert(
    src.includes('.eq("slug", botSlug)') || src.includes(".eq('slug', botSlug)"),
    "queries bots table by slug"
  );
  assert(
    src.includes("botLookup.nurse_id") || src.includes("serverNurseId"),
    "derives serverNurseId from DB result"
  );

  // Must NOT use nurse_id from botConfig after the lookup
  // (botConfig.nurse_id may still appear in dead/old code paths we already replaced)
  const lines = src.split("\n");
  const badLines = lines.filter(
    (l) =>
      l.includes("botConfig.nurse_id") &&
      !l.trimStart().startsWith("//") &&
      !l.trimStart().startsWith("*")
  );
  assert(badLines.length === 0, "no live uses of botConfig.nurse_id");

  const badBotId = lines.filter(
    (l) =>
      l.includes("botConfig.bot_id") &&
      !l.trimStart().startsWith("//") &&
      !l.trimStart().startsWith("*")
  );
  assert(badBotId.length === 0, "no live uses of botConfig.bot_id");

  // Missing slug must return 400
  assert(src.includes('status: 400') || src.includes("status:400"), "missing slug → 400");
  // Unknown slug must return 404
  assert(src.includes('status: 404') || src.includes("status:404"), "unknown slug → 404");
}

// ── /api/extract-intake ────────────────────────────────────────────────────
console.log("\n/api/extract-intake internal-only + nurse_id trust:");
{
  const src = readRoute("app/api/extract-intake/route.ts");

  // Must require INTERNAL_SECRET header — fail closed when env var missing
  assert(src.includes("INTERNAL_SECRET"), "checks INTERNAL_SECRET env var");
  assert(src.includes("Server misconfiguration"), "returns 500 when INTERNAL_SECRET unset (fail closed)");
  assert(src.includes("Unauthorized"), "returns 401 when header missing/wrong");
  assert(src.includes("logError"), "calls logError when INTERNAL_SECRET unset");

  // Must NOT destructure nurse_id from the request body
  const bodyDestructure = src.match(/const\s*\{([^}]+)\}\s*=\s*await request\.json\(\)/s)?.[1] ?? "";
  assert(!bodyDestructure.includes("nurse_id"), "nurse_id not in body destructure");

  // Must validate bot_id
  assert(src.includes("Invalid bot_id"), "rejects missing/invalid bot_id");

  // Must look up nurse_id from bots table
  assert(
    src.includes('.select("nurse_id")') || src.includes(".select('nurse_id')"),
    "selects nurse_id from bots table"
  );
  assert(
    src.includes("botRow.nurse_id") || src.includes("botRow?.nurse_id"),
    "derives nurse_id from DB result"
  );

  // Must not use a caller-supplied nurse_id for DB writes
  const insertBlock = src.match(/\.insert\(\{([^}]+)\}/s)?.[1] ?? "";
  assert(!insertBlock.includes("nurse_id: body") && !insertBlock.includes("nurse_id: req"), "insert does not use body nurse_id");
}

// ── /api/chat passes INTERNAL_SECRET to extract-intake ───────────────────
console.log("\n/api/chat → extract-intake header:");
{
  const src = readRoute("app/api/chat/route.ts");
  assert(src.includes("INTERNAL_SECRET"), "passes INTERNAL_SECRET header to extract-intake");
  assert(src.includes("Authorization"), "Authorization header present in extract-intake fetch");
}

// ── /api/intake deleted ────────────────────────────────────────────────────
console.log("\n/api/intake deleted:");
{
  let exists = false;
  try { readRoute("app/api/intake/route.ts"); exists = true; } catch {}
  assert(!exists, "/api/intake/route.ts does not exist (deleted)");
}

// ── /api/bot/[slug] ────────────────────────────────────────────────────────
console.log("\n/api/bot/[slug] field allowlist:");
{
  const src = readRoute("app/api/bot/[slug]/route.ts");

  // Private fields must not appear in the select string
  const selectMatch = src.match(/PUBLIC_BOT_FIELDS\s*=\s*["'`]([^"'`]+)["'`]/s);
  const fields = selectMatch?.[1] ?? "";
  assert(!fields.includes("nurse_id"), "nurse_id not in PUBLIC_BOT_FIELDS");
  assert(!fields.includes('"id"') && !fields.includes(" id,") && !fields.includes(" id\n"), "row id not in PUBLIC_BOT_FIELDS");
  assert(!fields.includes("notification_email"), "notification_email not in PUBLIC_BOT_FIELDS");
  assert(!fields.includes("alert_email"), "alert_email not in PUBLIC_BOT_FIELDS");
  assert(!fields.includes("alert_phone"), "alert_phone not in PUBLIC_BOT_FIELDS");
  assert(!fields.includes("nurse_email"), "nurse_email not in PUBLIC_BOT_FIELDS");

  // Must not call auth.admin.getUserById (private)
  assert(!src.includes("auth.admin.getUserById"), "no auth.admin.getUserById call");

  // Must not spread entire row
  assert(!src.includes("...data"), "response does not spread entire bot row");
}

// ── /api/healing — already safe (uses treatment_id from body, not nurse_id)
console.log("\n/api/healing nurse_id trust:");
{
  const src = readRoute("app/api/healing/route.ts");
  const bodyDestructure = src.match(/const\s*\{([^}]+)\}\s*=\s*(?:await request\.json\(\)|body)/s)?.[1] ?? "";
  assert(!bodyDestructure.includes("nurse_id"), "nurse_id not accepted from body");
  assert(src.includes("treatment_id"), "uses treatment_id to scope the request");
}

// ── summary ────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
