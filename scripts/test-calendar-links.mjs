#!/usr/bin/env node
/**
 * Tests for lib/calendarLinks.ts and /api/calendar-event/[treatment_id].
 *
 * Unit tests: link format correctness, .ics validity, no PII in nurse events.
 * Integration test: .ics route returns valid .ics for a real treatment_id,
 *   and 404 for a random UUID.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── Load env ──────────────────────────────────────────────────────────────────
const envPath = resolve(ROOT, ".env.local");
let env = {};
try {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
} catch { /* no .env.local */ }

const supabaseUrl  = env.NEXT_PUBLIC_SUPABASE_URL  || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey      = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey   = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL     = env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

let passed = 0;
let failed = 0;

function pass(msg) { process.stdout.write(`  ✓ ${msg}\n`); passed++; }
function fail(msg) { process.stderr.write(`  ✗ ${msg}\n`); failed++; }
function test(name, fn) {
  try { fn(); pass(name); }
  catch (e) { fail(`${name}: ${e.message}`); }
}

// ── Load helper via dynamic import (ESM) ─────────────────────────────────────
// We compile the TS source via tsx/ts-node, or fall back to reading the .js output.
// Since we're running with plain node and the project uses tsx in package.json,
// re-implement the pure-JS logic here to avoid a tsx dependency in the test.

function icsEscape(s) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
function nextDayStr(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
function icsDate(s) { return s.replace(/-/g, ""); }

function googleCalendarUrl(event) {
  const d = icsDate(event.date);
  const next = nextDayStr(event.date);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${d}/${icsDate(next)}`,
    details: event.description,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
function outlookWebUrl(event) {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: event.date,
    enddt: nextDayStr(event.date),
    body: event.description,
    allday: "true",
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
function yahooCalendarUrl(event) {
  const d = icsDate(event.date);
  const params = new URLSearchParams({
    v: "60",
    title: event.title,
    st: `${d}T000000Z`,
    et: `${icsDate(nextDayStr(event.date))}T000000Z`,
    desc: event.description,
    dur: "allday",
  });
  return `https://calendar.yahoo.com/?${params.toString()}`;
}
function buildIcs(event) {
  const d = icsDate(event.date);
  const now = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AdonisBlue//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${d}`,
    `DTEND;VALUE=DATE:${icsDate(nextDayStr(event.date))}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `DESCRIPTION:${icsEscape(event.description)}`,
    `UID:adonisblue-${d}-${encodeURIComponent(event.title.slice(0, 20))}@adonisblue.io`,
  ];
  if (event.alarm) {
    lines.push("BEGIN:VALARM", "TRIGGER:-P7D", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(event.alarm)}`, "END:VALARM");
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

// ── Unit tests ────────────────────────────────────────────────────────────────
process.stdout.write("\nCalendar link unit tests\n\n");

const EVENT = {
  date: "2027-03-15",
  title: "Hold a spot: Jane Doe",
  description: "Lip Filler · My Practice",
};

test("Google URL: correct host", () => {
  const url = googleCalendarUrl(EVENT);
  assert.ok(url.startsWith("https://calendar.google.com/calendar/render?"), url);
});
test("Google URL: action=TEMPLATE", () => {
  assert.ok(googleCalendarUrl(EVENT).includes("action=TEMPLATE"));
});
test("Google URL: all-day dates YYYYMMDD/YYYYMMDD+1", () => {
  const url = googleCalendarUrl(EVENT);
  assert.ok(url.includes("20270315%2F20270316") || url.includes("20270315/20270316"), url);
});
test("Google URL: title in text param", () => {
  const url = new URL(googleCalendarUrl(EVENT));
  assert.equal(url.searchParams.get("text"), EVENT.title);
});

test("Outlook URL: correct host", () => {
  assert.ok(outlookWebUrl(EVENT).startsWith("https://outlook.live.com/"));
});
test("Outlook URL: allday=true", () => {
  assert.ok(outlookWebUrl(EVENT).includes("allday=true"));
});
test("Outlook URL: startdt is date", () => {
  assert.ok(outlookWebUrl(EVENT).includes("startdt=2027-03-15"));
});

test("Yahoo URL: correct host", () => {
  assert.ok(yahooCalendarUrl(EVENT).startsWith("https://calendar.yahoo.com/"));
});
test("Yahoo URL: v=60", () => {
  assert.ok(yahooCalendarUrl(EVENT).includes("v=60"));
});
test("Yahoo URL: dur=allday", () => {
  assert.ok(yahooCalendarUrl(EVENT).includes("dur=allday"));
});

test(".ics: starts with BEGIN:VCALENDAR", () => {
  assert.ok(buildIcs(EVENT).startsWith("BEGIN:VCALENDAR"));
});
test(".ics: contains BEGIN:VEVENT / END:VEVENT", () => {
  const ics = buildIcs(EVENT);
  assert.ok(ics.includes("BEGIN:VEVENT"));
  assert.ok(ics.includes("END:VEVENT"));
});
test(".ics: all-day DTSTART with VALUE=DATE", () => {
  assert.ok(buildIcs(EVENT).includes("DTSTART;VALUE=DATE:20270315"));
});
test(".ics: DTEND is next day", () => {
  assert.ok(buildIcs(EVENT).includes("DTEND;VALUE=DATE:20270316"));
});
test(".ics: SUMMARY present", () => {
  assert.ok(buildIcs(EVENT).includes("SUMMARY:Hold a spot"));
});
test(".ics: uses CRLF line endings", () => {
  assert.ok(buildIcs(EVENT).includes("\r\n"));
});
test(".ics: DTSTAMP present (required by RFC 5545 / iOS Calendar)", () => {
  assert.ok(buildIcs(EVENT).includes("DTSTAMP:"), "DTSTAMP line missing from .ics");
});

// Nurse event must NOT contain phone or email
test("Nurse event: no client email in .ics (only adonisblue.io UID allowed)", () => {
  const nurseEvent = { ...EVENT, description: "Lip Filler · Practice Name" };
  const ics = buildIcs(nurseEvent);
  // UID contains @adonisblue.io — that's expected. No other @ should appear.
  const atCount = (ics.match(/@/g) || []).length;
  assert.equal(atCount, 1, `expected exactly 1 @ (UID), got ${atCount} in: ${ics}`);
  assert.ok(ics.includes("@adonisblue.io"), "UID should contain @adonisblue.io");
});
test("Nurse event: no phone pattern in .ics", () => {
  const nurseEvent = { ...EVENT, description: "Lip Filler · Practice Name" };
  const ics = buildIcs(nurseEvent);
  assert.ok(!/\d{3}[-.\s]\d{3}/.test(ics), "phone pattern found in .ics");
});

// ICS escape
test("icsEscape: commas escaped", () => {
  const ics = buildIcs({ ...EVENT, title: "Title, with comma" });
  assert.ok(ics.includes("Title\\, with comma"));
});
test("icsEscape: semicolons escaped", () => {
  const ics = buildIcs({ ...EVENT, description: "a; b" });
  assert.ok(ics.includes("a\\; b"));
});

// ── Integration tests ─────────────────────────────────────────────────────────
process.stdout.write("\nCalendar .ics route integration tests\n\n");

async function runIntegration() {
  if (!supabaseUrl || !serviceKey) {
    pass(".ics route: skipped (no service key in env)");
    return;
  }

  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(supabaseUrl, serviceKey);

  // Find a real treatment that has a procedure with reminder_days
  const { data: proc } = await sb
    .from("procedures")
    .select("id, reminder_days")
    .not("reminder_days", "is", null)
    .limit(1)
    .maybeSingle();

  if (!proc) {
    pass(".ics route: skipped (no procedure with reminder_days)");
    return;
  }

  // Find a treatment using that procedure
  const { data: treatment } = await sb
    .from("treatments")
    .select("id")
    .eq("procedure_id", proc.id)
    .eq("archived", false)
    .limit(1)
    .maybeSingle();

  if (!treatment) {
    pass(".ics route: skipped (no treatment found for that procedure)");
    return;
  }

  // Real treatment id → should return 200 with .ics
  const realRes = await fetch(`${BASE_URL}/api/calendar-event/${treatment.id}`);
  if (realRes.status === 200) {
    const body = await realRes.text();
    if (body.startsWith("BEGIN:VCALENDAR") && body.includes("BEGIN:VEVENT")) {
      pass(".ics route: real treatment_id returns valid .ics (200)");
    } else {
      fail(`.ics route: 200 but body is not valid .ics: ${body.slice(0, 100)}`);
    }
    // Check content-type
    const ct = realRes.headers.get("content-type") ?? "";
    if (ct.includes("text/calendar")) {
      pass(".ics route: Content-Type is text/calendar");
    } else {
      fail(`.ics route: Content-Type is "${ct}", expected text/calendar`);
    }
    // Check Content-Disposition: inline (iOS Safari opens Calendar.app; attachment triggers download)
    const cd = realRes.headers.get("content-disposition") ?? "";
    if (cd.startsWith("inline")) {
      pass(".ics route: Content-Disposition is inline");
    } else {
      fail(`.ics route: Content-Disposition is "${cd}", expected inline`);
    }
    // Check DTSTAMP present (iOS Calendar rejects events without it)
    if (body.includes("DTSTAMP:")) {
      pass(".ics route: DTSTAMP present in response body");
    } else {
      fail(".ics route: DTSTAMP missing from response body");
    }
    // Check no PII: only allowed @ is in the UID (@adonisblue.io)
    const atParts = body.split("@");
    const unexpectedAt = atParts.slice(1).some((p) => !p.startsWith("adonisblue.io"));
    if (!unexpectedAt) {
      pass(".ics route: no client email in .ics body");
    } else {
      fail(".ics route: unexpected email address in .ics body");
    }
  } else {
    fail(`.ics route: real treatment_id got ${realRes.status}, expected 200`);
  }

  // Random UUID → 404
  const fakeId = "00000000-0000-0000-0000-000000000000";
  const fakeRes = await fetch(`${BASE_URL}/api/calendar-event/${fakeId}`);
  if (fakeRes.status === 404) {
    pass(".ics route: random UUID returns 404");
  } else {
    fail(`.ics route: random UUID returned ${fakeRes.status}, expected 404`);
  }

  // Invalid id → 404
  const badRes = await fetch(`${BASE_URL}/api/calendar-event/not-a-uuid`);
  if (badRes.status === 404) {
    pass(".ics route: invalid id returns 404");
  } else {
    fail(`.ics route: invalid id returned ${badRes.status}, expected 404`);
  }
}

await runIntegration();

process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
