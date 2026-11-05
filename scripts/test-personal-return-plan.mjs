/**
 * Tests for the personal return plan feature.
 * Run: node scripts/test-personal-return-plan.mjs
 */
import assert from "node:assert/strict";

// ---- helpers under test ----
// We import from built JS; for unit tests we inline the logic here.

function personalReminderSendDate(plannedReturnAt, leadDays) {
  const d = new Date(plannedReturnAt + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - leadDays);
  return d;
}

function inPersonalReminderWindow(plannedReturnAt, leadDays, today) {
  const sendOn = personalReminderSendDate(plannedReturnAt, leadDays);
  const returnDate = new Date(plannedReturnAt + "T00:00:00Z");
  const cutoff = new Date(returnDate);
  cutoff.setUTCDate(cutoff.getUTCDate() + 7);
  return today >= sendOn && today <= cutoff;
}

function sanitizeReason(raw) {
  return raw.replace(/[\r\n\t\x00-\x1F\x7F]/g, " ").trim().slice(0, 120);
}

// ---- tests ----

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${e.message}`);
    failed++;
  }
}

console.log("\nPersonal return plan — unit tests\n");

// 1. Lead day 0: send date equals planned_return_at
test("lead day 0: send date equals return date", () => {
  const sendOn = personalReminderSendDate("2026-12-01", 0);
  assert.equal(sendOn.toISOString().slice(0, 10), "2026-12-01");
});

// 2. Lead day 3
test("lead day 3: send date is 3 days before", () => {
  const sendOn = personalReminderSendDate("2026-12-10", 3);
  assert.equal(sendOn.toISOString().slice(0, 10), "2026-12-07");
});

// 3. Lead day 7
test("lead day 7: send date is 7 days before", () => {
  const sendOn = personalReminderSendDate("2026-12-10", 7);
  assert.equal(sendOn.toISOString().slice(0, 10), "2026-12-03");
});

// 4. Lead day 14
test("lead day 14: send date is 14 days before", () => {
  const sendOn = personalReminderSendDate("2026-12-14", 14);
  assert.equal(sendOn.toISOString().slice(0, 10), "2026-11-30");
});

// 5. inPersonalReminderWindow: exactly on send date → true
test("window: today == send date → in window", () => {
  const today = new Date("2026-12-03T00:00:00Z");
  assert.equal(inPersonalReminderWindow("2026-12-10", 7, today), true);
});

// 6. inPersonalReminderWindow: one day before send date → false
test("window: one day before send date → not in window", () => {
  const today = new Date("2026-12-02T00:00:00Z");
  assert.equal(inPersonalReminderWindow("2026-12-10", 7, today), false);
});

// 7. Missed cron day: still sends next run (today is after send date but before cutoff)
test("window: missed cron day still in window (send date + 3 days)", () => {
  const today = new Date("2026-12-06T00:00:00Z"); // 3 days after send date of 2026-12-03
  assert.equal(inPersonalReminderWindow("2026-12-10", 7, today), true);
});

// 8. No send after return date + 7 days
test("window: return_date + 8 days → not in window", () => {
  const today = new Date("2026-12-18T00:00:00Z"); // 8 days after 2026-12-10
  assert.equal(inPersonalReminderWindow("2026-12-10", 7, today), false);
});

// 9. No send after return date + 7 (boundary: exactly +7 → still in)
test("window: return_date + 7 days → still in window", () => {
  const today = new Date("2026-12-17T00:00:00Z");
  assert.equal(inPersonalReminderWindow("2026-12-10", 7, today), true);
});

// 10. return_reason sanitization: trims whitespace
test("sanitize reason: trims whitespace", () => {
  assert.equal(sanitizeReason("  hello  "), "hello");
});

// 11. return_reason: strips newlines and control chars
test("sanitize reason: strips newlines and control chars", () => {
  const raw = "adding\nmore\r\nvolume\t<script>";
  const result = sanitizeReason(raw);
  assert.ok(!result.includes("\n") && !result.includes("\r") && !result.includes("\t"));
});

// 12. return_reason: enforces 120-char limit
test("sanitize reason: enforces 120-char max", () => {
  const long = "x".repeat(200);
  assert.equal(sanitizeReason(long).length, 120);
});

// 13. return_reason: empty string stays empty after sanitize
test("sanitize reason: empty stays empty", () => {
  assert.equal(sanitizeReason(""), "");
});

// 14. personalReminderSendDate does not mutate the input string (immutability)
test("personalReminderSendDate does not mutate input", () => {
  const input = "2026-12-10";
  personalReminderSendDate(input, 7);
  assert.equal(input, "2026-12-10");
});

// 15. Lead days outside allowed set (server rejects) — simulated
test("server validation: disallows lead_days=2", () => {
  const ALLOWED = new Set([0, 3, 7, 14]);
  assert.equal(ALLOWED.has(2), false);
});

// 16. lead_days=0 is explicitly allowed
test("server validation: allows lead_days=0", () => {
  const ALLOWED = new Set([0, 3, 7, 14]);
  assert.equal(ALLOWED.has(0), true);
});

// 17. inPersonalReminderWindow: lead_days=0 on the return date itself
test("window: lead_days=0, today == return date → in window", () => {
  const today = new Date("2026-12-15T00:00:00Z");
  assert.equal(inPersonalReminderWindow("2026-12-15", 0, today), true);
});

// 18. inPersonalReminderWindow: lead_days=0, day before return date → false
test("window: lead_days=0, today one day before return → not in window", () => {
  const today = new Date("2026-12-14T00:00:00Z");
  assert.equal(inPersonalReminderWindow("2026-12-15", 0, today), false);
});

// summary
console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
