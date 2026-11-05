/**
 * Tests that the Plan-her-return reminder auto-select logic is correct:
 * - When the selected lead days become invalid (reminder date would be in the past),
 *   auto-select switches to the largest still-valid option.
 * - 5 days out + default 7 → switches to 3 (not 0, not 7).
 * - Only "On the day" valid → stays at 0 (not forced to invalid 7).
 * - Valid selection → no change.
 *
 * Run: node scripts/test-return-plan-reminder.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}

console.log("\nReturn-plan reminder auto-select tests\n");

// ── Replicate the filter + auto-select logic from app/aftercare/page.tsx ──────

const OPTIONS = [14, 7, 3, 0]; // days-before options in render order (largest first)

function computeAutoSelect(returnPlanDate, currentLeadDays) {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);

  const valid = OPTIONS.filter(days => {
    const d = new Date(returnPlanDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - days);
    return d >= tomorrow;
  });

  if (valid.length > 0 && !valid.includes(currentLeadDays)) {
    return valid[0]; // first = largest still-valid option
  }
  return currentLeadDays; // no change needed
}

function daysFromNow(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Core scenario the user reported: 5 days out, default 7 → switch to 3
test("5 days out + leadDays=7 → switches to 3 (largest valid)", () => {
  const result = computeAutoSelect(daysFromNow(5), 7);
  assert.equal(result, 3, `Expected 3, got ${result}`);
});

// Similarly for 4 days out: only 3 and 0 are valid; default 7 → 3
test("4 days out + leadDays=7 → switches to 3", () => {
  assert.equal(computeAutoSelect(daysFromNow(4), 7), 3);
});

// 3 days out: only 0 is valid (Nov 9 - 3 = Nov 6 >= tomorrow Nov 5 on 3-day boundary)
// Actually: "3 days before" means reminder = returnDate - 3; if returnDate is 3 days from now,
// reminder = today, which is < tomorrow → filtered. So only 0 is valid.
test("3 days out + leadDays=7 → switches to 0 (On the day)", () => {
  assert.equal(computeAutoSelect(daysFromNow(3), 7), 0);
});

// Only "On the day" valid, default already 0 → no change
test("2 days out + leadDays=0 → no change (already valid)", () => {
  assert.equal(computeAutoSelect(daysFromNow(2), 0), 0);
});

// 15 days out: all options valid; leadDays=7 → no change needed
test("15 days out + leadDays=7 → no change (7 is valid)", () => {
  assert.equal(computeAutoSelect(daysFromNow(15), 7), 7);
});

// 10 days out: 7 and below valid (14 is not); leadDays=14 → switches to 7
test("10 days out + leadDays=14 → switches to 7", () => {
  assert.equal(computeAutoSelect(daysFromNow(10), 14), 7);
});

// 30 days out: all valid; leadDays=14 → no change
test("30 days out + leadDays=14 → no change (14 is valid)", () => {
  assert.equal(computeAutoSelect(daysFromNow(30), 14), 14);
});

// ── Source check: auto-select logic in the page uses valid[0] (largest first) ─

const src = readFileSync(join(ROOT, "app/aftercare/page.tsx"), "utf8");

test("auto-select useEffect uses OPTIONS [14, 7, 3, 0] order (largest first)", () => {
  assert.ok(
    src.includes("const OPTIONS = [14, 7, 3, 0]"),
    "OPTIONS must be [14, 7, 3, 0] so valid[0] is always the largest remaining option"
  );
});

test("auto-select sets returnPlanLeadDays to valid[0] when current is invalid", () => {
  assert.ok(
    src.includes("!valid.includes(returnPlanLeadDays)") &&
    src.includes("setReturnPlanLeadDays(valid[0])"),
    "auto-select must switch to valid[0] when current leadDays is not in valid list"
  );
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
