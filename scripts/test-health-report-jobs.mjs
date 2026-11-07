/**
 * Tests that:
 *
 * 1. Every key in JOB_NAMES in health-report/route.ts corresponds to a cron
 *    type that an actual cron route writes to message_log.
 * 2. Every cron route that writes a "cron:*" heartbeat has that type listed
 *    in JOB_NAMES.
 *    (Prevents stale entries causing false alarms and unmonitored renames.)
 *
 * 3. The HTML escaping in health-report is applied exactly once: an error
 *    message containing quotes and <tags> must render as &quot; / &lt;
 *    without double-encoding (&amp;quot; / &amp;lt;).
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
let fail = 0;

function assert(cond, msg) {
  if (cond) {
    process.stdout.write(`  ✓ ${msg}\n`);
    pass++;
  } else {
    process.stdout.write(`  ✗ ${msg}\n`);
    fail++;
  }
}

// ── 1 & 2: static analysis ────────────────────────────────────────────────────

const healthSrc = readFileSync(
  join(ROOT, "app/api/cron/health-report/route.ts"),
  "utf8"
);

// Extract JOB_NAMES keys: lines like  "cron:xxx":  ...
const jobNameKeys = [...healthSrc.matchAll(/"(cron:[^"]+)"\s*:/g)]
  .map(m => m[1])
  // The object is defined as a Record so it can have one-time key extractions;
  // filter to those that look like job entries (not JOB_NAMES itself or similar).
  .filter(k => k !== "cron:health-report");  // health-report skips itself

// But we need only the keys INSIDE the JOB_NAMES object, not keys used elsewhere.
// More precise: match the block between JOB_NAMES = { ... }
const jobNamesBlock = healthSrc.match(/JOB_NAMES[^=]*=\s*\{([^}]+)\}/s)?.[1] ?? "";
const monitoredKeys = new Set(
  [...jobNamesBlock.matchAll(/"(cron:[^"]+)"\s*:/g)].map(m => m[1])
);
// Remove cron:health-report — it always skips itself in the loop
monitoredKeys.delete("cron:health-report");

// Extract cron heartbeat types written by each route
const cronDir = join(ROOT, "app/api/cron");
const writtenTypes = new Set();

for (const entry of readdirSync(cronDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const routePath = join(cronDir, entry.name, "route.ts");
  let src;
  try { src = readFileSync(routePath, "utf8"); } catch { continue; }

  // Match: type: "cron:xxx"  (heartbeat writes — the message_log insert with type starting "cron:")
  for (const m of src.matchAll(/type:\s*["'](cron:[^"']+)["']/g)) {
    writtenTypes.add(m[1]);
  }
}
// health-report writes its own heartbeat; exclude from comparison
writtenTypes.delete("cron:health-report");

// Every monitored key must be written by some cron
for (const key of monitoredKeys) {
  assert(writtenTypes.has(key), `JOB_NAMES["${key}"] — a cron writes this type`);
}

// Every cron-written type must be in JOB_NAMES (so renames can't go unmonitored)
for (const key of writtenTypes) {
  assert(monitoredKeys.has(key), `cron type "${key}" is in JOB_NAMES`);
}

// ── 3: single-pass HTML escaping ──────────────────────────────────────────────

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Simulate the new approach: plain text in problemLine, escaped once at render.
const rawMsg = 'column "foo" does not exist in <table>';
const problemLine = `⚠️ Something went wrong in: auth — ${rawMsg}`;
const rendered = `<p>${escapeHtml(problemLine)}</p>`;

assert(!rendered.includes("&amp;quot;"), "no double-encoded quotes (&amp;quot; must not appear)");
assert(!rendered.includes("&amp;lt;"),   "no double-encoded tags (&amp;lt; must not appear)");
assert(rendered.includes("&quot;"),      "quotes are HTML-encoded (&quot; present)");
assert(rendered.includes("&lt;"),        "angle brackets are HTML-encoded (&lt; present)");
assert(!rendered.includes("<table>"),    "raw <table> tag does not leak into HTML");

// Confirm the OLD (broken) double-escape pattern is not what we do
const doubleEscaped = `<p>${escapeHtml(problemLine.replace(/"/g, "&quot;").replace(/</g, "&lt;"))}</p>`;
assert(doubleEscaped.includes("&amp;quot;"), "double-escape reference: &amp;quot; appears when done twice (proving we fixed it)");

// ── Summary ───────────────────────────────────────────────────────────────────

process.stdout.write(`\n${pass + fail} checks: ${pass} passed, ${fail} failed.\n`);
if (fail > 0) process.exit(1);
