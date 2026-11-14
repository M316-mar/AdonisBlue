/**
 * Asserts that every route that sends a client aftercare email uses buildAftercareEmail
 * and does NOT contain inline HTML construction (DOCTYPE, old greeting, etc.).
 *
 * Routes that send client aftercare email:
 *   - app/api/cron/send-due-aftercare/route.ts   (cron job)
 *   - app/api/send-aftercare/route.ts             (preview GET + scheduled POST)
 *   - app/api/treatments/[id]/aftercare-now/route.ts  ("Send now" button)
 *
 * Routes explicitly excluded (they send different email types):
 *   - cron/aftercare-nudge   → nurse-facing nudge, not a client email
 *   - cron/wellness-checkin  → 24h check-in, different template
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

const AFTERCARE_ROUTES = [
  "app/api/cron/send-due-aftercare/route.ts",
  "app/api/send-aftercare/route.ts",
  "app/api/treatments/[id]/aftercare-now/route.ts",
];

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

console.log("\naftercare routes use buildAftercareEmail");

for (const relPath of AFTERCARE_ROUTES) {
  const src = readFileSync(resolve(ROOT, relPath), "utf8");

  assert(
    src.includes('from "@/lib/buildAftercareEmail"'),
    `${relPath}: imports buildAftercareEmail`
  );

  assert(
    src.includes("buildAftercareEmail("),
    `${relPath}: calls buildAftercareEmail()`
  );

  assert(
    !src.includes("You're glowing") && !src.includes("You’re glowing"),
    `${relPath}: no old greeting "You're glowing"`
  );

  // The route must NOT contain its own <!DOCTYPE html> (that belongs in the builder)
  assert(
    !src.includes("<!DOCTYPE html>") && !src.includes("<!doctype html>"),
    `${relPath}: no inline DOCTYPE (HTML built by shared builder)`
  );
}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
