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

// Mirrors lib/reminderDate.ts formatDueDate — always UTC
function formatDueDate(due, options = { month: "long", day: "numeric" }) {
  if (isNaN(due.getTime())) return "soon";
  return due.toLocaleDateString("en-US", { timeZone: "UTC", ...options });
}

// Mirrors return-reminder/route.ts: dueISO → UTC Date → formatDueDate
function nurseEmailDueDate(dueISO) {
  return formatDueDate(new Date(dueISO + "T00:00:00Z"));
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

  // Success-screen date display: UTC display must not shift date back in negative-offset zones
  // treatment Oct 22 + 14 days → "Nov 5" (not "Nov 4" with UTC-naive toLocaleDateString)
  {
    label: 'success screen: dueDate("2026-10-22", 14) displays as "Nov 5" UTC',
    result: dueDate("2026-10-22", 14).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }),
    expect: "Nov 5",
  },
  // treatment Oct 22, 2025 + 180 days → due Apr 20, 2026; reminder send → Apr 6
  {
    label: 'success screen: dueDate("2025-10-22", 180) → due Apr 20, 2026',
    result: dueDate("2025-10-22", 180).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }),
    expect: "Apr 20",
  },
  {
    label: 'success screen: reminderSendDate(dueDate("2025-10-22", 180)) → Apr 6, 2026',
    result: reminderSendDate(dueDate("2025-10-22", 180)).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" }),
    expect: "Apr 6",
  },
  // Email body uses long month format — must not shift the day
  {
    label: 'email body: dueDate("2025-10-22", 180) long format → "April 20"',
    result: dueDate("2025-10-22", 180).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric" }),
    expect: "April 20",
  },
  // Cross-email consistency: client reminder and nurse Monday email must show the same due date
  // client email uses: formatDueDate(dueDate(treatmentDate, reminderDays))
  // nurse email uses:  formatDueDate(new Date(dueISO + "T00:00:00Z"))  where dueISO = dueDate(...).toISOString().slice(0,10)
  {
    label: 'cross-email: client reminder date matches nurse email date (Oct 22 + 180)',
    result: (() => {
      const due = dueDate("2025-10-22", 180);
      const clientDate = formatDueDate(due);
      const dueISO = due.toISOString().slice(0, 10);
      const nurseDate = nurseEmailDueDate(dueISO);
      return clientDate === nurseDate ? clientDate : `MISMATCH: client=${clientDate} nurse=${nurseDate}`;
    })(),
    expect: "April 20",
  },
  {
    label: 'cross-email: client reminder date matches nurse email date (Oct 23 + 180)',
    result: (() => {
      const due = dueDate("2025-10-23", 180);
      const clientDate = formatDueDate(due);
      const dueISO = due.toISOString().slice(0, 10);
      const nurseDate = nurseEmailDueDate(dueISO);
      return clientDate === nurseDate ? clientDate : `MISMATCH: client=${clientDate} nurse=${nurseDate}`;
    })(),
    expect: "April 21",
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
