#!/usr/bin/env node
/**
 * test-dates.mjs — verify parseTreatmentDate / dueDate / reminderSendDate /
 * inReminderWindow / formatTreatmentDate with every real DB format.
 *
 * Run: node scripts/test-dates.mjs
 * Any failure exits 1 so `npm run check` fails.
 */

// ── Inline the logic from lib/formatTreatmentDate.ts + lib/reminderDate.ts ──

function parseTreatmentDate(dateStr) {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

function formatTreatmentDate(dateStr, options) {
  const d = parseTreatmentDate(dateStr);
  return d ? d.toLocaleDateString("en-US", options) : "Date not recorded";
}

function dueDate(dateStr, reminderDays) {
  const local = parseTreatmentDate(dateStr);
  if (!local) return new Date(NaN);
  const d = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
  d.setUTCDate(d.getUTCDate() + reminderDays);
  return d;
}

function reminderSendDate(due) {
  const d = new Date(due);
  d.setUTCDate(d.getUTCDate() - 14);
  return d;
}

function inReminderWindow(due, today) {
  const sendOn = reminderSendDate(due);
  const cutoff = new Date(due);
  cutoff.setUTCDate(cutoff.getUTCDate() + 7);
  return today >= sendOn && today <= cutoff;
}

// UTC midnight helper for test dates
function utc(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }

// ── Test cases ───────────────────────────────────────────────────────────────

const due2026_10_23 = dueDate("2026-07-25", 90); // reference

const cases = [
  // parseTreatmentDate — all three DB formats must return the same calendar date
  {
    label: 'parseTreatmentDate("2026-07-25") returns 2026-07-25',
    result: parseTreatmentDate("2026-07-25")?.toISOString().slice(0, 10),
    expect: "2026-07-25",
  },
  {
    label: 'parseTreatmentDate("2026-07-25 00:00:00+00") returns 2026-07-25',
    result: parseTreatmentDate("2026-07-25 00:00:00+00")?.toISOString().slice(0, 10),
    expect: "2026-07-25",
  },
  {
    label: 'parseTreatmentDate("2026-07-25T00:00:00+00:00") returns 2026-07-25',
    result: parseTreatmentDate("2026-07-25T00:00:00+00:00")?.toISOString().slice(0, 10),
    expect: "2026-07-25",
  },

  // dueDate — all three formats must compute the same due date
  {
    label: 'dueDate("2026-07-25", 90) → 2026-10-23',
    result: dueDate("2026-07-25", 90).toISOString().slice(0, 10),
    expect: "2026-10-23",
  },
  {
    label: 'dueDate("2026-07-25 00:00:00+00", 90) → 2026-10-23',
    result: dueDate("2026-07-25 00:00:00+00", 90).toISOString().slice(0, 10),
    expect: "2026-10-23",
  },
  {
    label: 'dueDate("2026-07-25T00:00:00+00:00", 90) → 2026-10-23',
    result: dueDate("2026-07-25T00:00:00+00:00", 90).toISOString().slice(0, 10),
    expect: "2026-10-23",
  },

  // reminderSendDate — due 2026-10-23 → send on 2026-10-09
  {
    label: "reminderSendDate(due=2026-10-23) → 2026-10-09",
    result: reminderSendDate(due2026_10_23).toISOString().slice(0, 10),
    expect: "2026-10-09",
  },

  // inReminderWindow — window is 2026-10-09 to 2026-10-30 (inclusive)
  {
    label: "inReminderWindow: today=2026-10-09 (first day) → true",
    result: String(inReminderWindow(due2026_10_23, utc(2026, 10, 9))),
    expect: "true",
  },
  {
    label: "inReminderWindow: today=2026-10-30 (last day, due+7) → true",
    result: String(inReminderWindow(due2026_10_23, utc(2026, 10, 30))),
    expect: "true",
  },
  {
    label: "inReminderWindow: today=2026-10-08 (one day before window) → false",
    result: String(inReminderWindow(due2026_10_23, utc(2026, 10, 8))),
    expect: "false",
  },
  {
    label: "inReminderWindow: today=2026-10-31 (one day after cutoff) → false",
    result: String(inReminderWindow(due2026_10_23, utc(2026, 10, 31))),
    expect: "false",
  },

  // formatTreatmentDate — both formats must show Oct 23 (no day shift)
  {
    label: 'formatTreatmentDate("2026-10-23") shows "Oct 23, 2026" (no day shift)',
    result: formatTreatmentDate("2026-10-23", { month: "short", day: "numeric", year: "numeric" }),
    expect: "Oct 23, 2026",
  },
  {
    label: 'formatTreatmentDate("2026-10-23 00:00:00+00") shows "Oct 23, 2026" (no day shift)',
    result: formatTreatmentDate("2026-10-23 00:00:00+00", { month: "short", day: "numeric", year: "numeric" }),
    expect: "Oct 23, 2026",
  },

  // Guard cases: null / empty / invalid inputs must never throw
  {
    label: "parseTreatmentDate(null) → null",
    result: String(parseTreatmentDate(null)),
    expect: "null",
  },
  {
    label: 'parseTreatmentDate("") → null',
    result: String(parseTreatmentDate("")),
    expect: "null",
  },
  {
    label: 'parseTreatmentDate("not-a-date") → null',
    result: String(parseTreatmentDate("not-a-date")),
    expect: "null",
  },
  {
    label: "dueDate(null, 90) → NaN (no throw)",
    result: String(isNaN(dueDate(null, 90).getTime())),
    expect: "true",
  },
  {
    label: 'dueDate("", 90) → NaN (no throw)',
    result: String(isNaN(dueDate("", 90).getTime())),
    expect: "true",
  },
  {
    label: 'dueDate("not-a-date", 90) → NaN (no throw)',
    result: String(isNaN(dueDate("not-a-date", 90).getTime())),
    expect: "true",
  },
  {
    label: 'dueDate("2026-07-25", 0) → 2026-07-25 (zero offset)',
    result: dueDate("2026-07-25", 0).toISOString().slice(0, 10),
    expect: "2026-07-25",
  },
];

// ── Run ──────────────────────────────────────────────────────────────────────

let pass = 0, fail = 0;
const BOLD = "\x1b[1m", RED = "\x1b[31m", GREEN = "\x1b[32m", RESET = "\x1b[0m";

for (const { label, result, expect } of cases) {
  const ok = result === expect;
  if (ok) pass++; else fail++;
  const tag = ok ? `${GREEN}PASS${RESET}` : `${RED}${BOLD}FAIL${RESET}`;
  const detail = ok ? "" : `  (expected: "${expect}", got: "${result}")`;
  console.log(`${tag}  ${label}${detail}`);
}

console.log(`\n${pass}/${pass + fail} passed${fail > 0 ? ` — ${BOLD}${RED}${fail} FAILED${RESET}` : ""}`);
if (fail > 0) process.exit(1);
