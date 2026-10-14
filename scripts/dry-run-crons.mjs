#!/usr/bin/env node
/**
 * Dry-run: shows what each cron would send for the current preview/prod data
 * without actually sending any emails.
 *
 * Usage: node scripts/dry-run-crons.mjs
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(url, key);

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

function header(title) {
  console.log(`\n${BOLD}${CYAN}${"─".repeat(60)}${RESET}`);
  console.log(`${BOLD}${CYAN}  ${title}${RESET}`);
  console.log(`${CYAN}${"─".repeat(60)}${RESET}`);
}

function row(label, value) {
  console.log(`  ${DIM}${label.padEnd(24)}${RESET}${value}`);
}

// ── cron:prep-reminders ──────────────────────────────────────────────────────
async function dryRunPrepReminders() {
  header("cron:prep-reminders  (9:00 UTC)");

  const now = new Date();
  const windowStart = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const windowEnd   = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString().split("T")[0];

  const { data: treatments, error } = await db
    .from("treatments")
    .select("id, procedure_name, treatment_date, intake_id, nurse_id, intakes(id, first_name, email)")
    .gte("treatment_date", windowStart)
    .lte("treatment_date", windowEnd)
    .is("prep_guide_sent_at", null)
    .not("intake_id", "is", null)
    .eq("archived", false);

  if (error) { console.error("  query error:", error.message); return; }
  if (!treatments?.length) { console.log(`  ${GREEN}nothing to send${RESET}`); return; }

  for (const t of treatments) {
    const intake = Array.isArray(t.intakes) ? t.intakes[0] : t.intakes;
    if (!intake?.email) continue;
    row("treatment_id", t.id);
    row("client", `${intake.first_name ?? "?"} <${intake.email}>`);
    row("procedure", t.procedure_name ?? "—");
    row("treatment_date", t.treatment_date);
    console.log(`  ${YELLOW}→ WOULD SEND prep_guide${RESET}\n`);
  }
}

// ── cron:reminders ───────────────────────────────────────────────────────────
async function dryRunReminders() {
  header("cron:reminders  (10:00 UTC)  — 6m/9m backup only");

  const now = new Date();
  const sixMonthsAgo  = new Date(now); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const nineMonthsAgo = new Date(now); nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9);

  const { data: remindedTreatments } = await db
    .from("treatments").select("intake_id").eq("reminder_sent", true);
  const excluded = new Set((remindedTreatments ?? []).map(t => t.intake_id));

  const [{ data: sixMonthDue }, { data: nineMonthDue }] = await Promise.all([
    db.from("intakes")
      .select("id, first_name, email, nurse_id")
      .not("aftercare_sent_at", "is", null)
      .eq("reminder_6m_sent", false)
      .eq("marketing_opt_out", false)
      .lte("aftercare_sent_at", sixMonthsAgo.toISOString())
      .not("email", "is", null),
    db.from("intakes")
      .select("id, first_name, email, nurse_id")
      .not("aftercare_sent_at", "is", null)
      .eq("reminder_9m_sent", false)
      .eq("marketing_opt_out", false)
      .lte("aftercare_sent_at", nineMonthsAgo.toISOString())
      .not("email", "is", null),
  ]);

  let count = 0;
  for (const intake of sixMonthDue ?? []) {
    if (excluded.has(intake.id)) { console.log(`  ${DIM}SKIP (has procedure reminder): ${intake.first_name} [6m]${RESET}`); continue; }
    row("intake_id", intake.id); row("client", `${intake.first_name} <${intake.email}>`);
    console.log(`  ${YELLOW}→ WOULD SEND reminder_6m${RESET}\n`); count++;
  }
  for (const intake of nineMonthDue ?? []) {
    if (excluded.has(intake.id)) { console.log(`  ${DIM}SKIP (has procedure reminder): ${intake.first_name} [9m]${RESET}`); continue; }
    row("intake_id", intake.id); row("client", `${intake.first_name} <${intake.email}>`);
    console.log(`  ${YELLOW}→ WOULD SEND reminder_9m${RESET}\n`); count++;
  }
  if (!count) console.log(`  ${GREEN}nothing to send${RESET}`);
}

// ── cron:reviews ─────────────────────────────────────────────────────────────
async function dryRunReviews() {
  header("cron:reviews  (11:00 UTC)  — window: treatment_date 14–30 days ago");

  const now = new Date();
  const fourteenDaysAgo = new Date(now); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const thirtyDaysAgo   = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentTreatments } = await db
    .from("treatments").select("intake_id")
    .gte("treatment_date", thirtyDaysAgo.toISOString().split("T")[0])
    .lte("treatment_date", fourteenDaysAgo.toISOString().split("T")[0])
    .eq("archived", false).not("intake_id", "is", null);

  const eligibleIds = [...new Set((recentTreatments ?? []).map(t => t.intake_id))];
  if (!eligibleIds.length) { console.log(`  ${GREEN}nothing to send${RESET}`); return; }

  const { data: intakes } = await db.from("intakes")
    .select("id, first_name, email, nurse_id")
    .in("id", eligibleIds)
    .eq("review_request_sent", false)
    .eq("survey_sent", false)
    .is("review_submitted_at", null)
    .eq("marketing_opt_out", false)
    .not("email", "is", null);

  if (!intakes?.length) { console.log(`  ${GREEN}nothing to send${RESET}`); return; }
  for (const i of intakes) {
    row("intake_id", i.id); row("client", `${i.first_name} <${i.email}>`);
    console.log(`  ${YELLOW}→ WOULD SEND review_request${RESET}\n`);
  }
}

// ── cron:treatment-reminders ─────────────────────────────────────────────────
async function dryRunTreatmentReminders() {
  header("cron:treatment-reminders  (12:00 UTC)  — procedure-specific, most recent only");

  const { data: treatments } = await db
    .from("treatments")
    .select("id, treatment_date, procedure_name, nurse_id, intake_id, procedure_id, intakes!inner(first_name, email, marketing_opt_out), procedures(name, reminder_days)")
    .eq("reminder_sent", false)
    .not("procedure_id", "is", null)
    .eq("archived", false)
    .eq("intakes.marketing_opt_out", false);

  if (!treatments?.length) { console.log(`  ${GREEN}nothing to send${RESET}`); return; }

  const mostRecentMap = new Map();
  for (const t of treatments) {
    const key = `${t.intake_id}:${t.procedure_id}`;
    const ex = mostRecentMap.get(key);
    if (!ex || new Date(t.treatment_date) > new Date(ex.treatment_date)) mostRecentMap.set(key, t);
  }

  const today = new Date();
  let count = 0;
  for (const t of mostRecentMap.values()) {
    const rDays = t.procedures?.reminder_days;
    if (!rDays) continue;
    const reminderDate = new Date(new Date(t.treatment_date).getTime() + rDays * 864e5);
    const diff = Math.floor((today - reminderDate) / 864e5);
    if (diff < 0 || diff > 1) continue;
    const intake = Array.isArray(t.intakes) ? t.intakes[0] : t.intakes;
    row("treatment_id", t.id); row("client", `${intake?.first_name} <${intake?.email}>`);
    row("procedure", t.procedure_name ?? "—"); row("reminder_days", rDays);
    console.log(`  ${YELLOW}→ WOULD SEND treatment_reminder${RESET}\n`); count++;
  }
  if (!count) console.log(`  ${GREEN}nothing due today${RESET}`);
}

// ── cron:wellness-checkin ────────────────────────────────────────────────────
async function dryRunWellnessCheckin() {
  header("cron:wellness-checkin  (13:00 UTC)  — 16–40h after aftercare");

  const now = new Date();
  const windowEnd   = new Date(now.getTime() - 16 * 36e5);
  const windowStart = new Date(now.getTime() - 40 * 36e5);

  const { data: treatments } = await db
    .from("treatments")
    .select("id, procedure_name, intake_id, nurse_id, intakes(id, first_name, email)")
    .eq("aftercare_sent", true)
    .is("wellness_checkin_sent_at", null)
    .gte("aftercare_sent_at", windowStart.toISOString())
    .lte("aftercare_sent_at", windowEnd.toISOString())
    .eq("archived", false);

  if (!treatments?.length) { console.log(`  ${GREEN}nothing to send${RESET}`); return; }
  for (const t of treatments) {
    const intake = Array.isArray(t.intakes) ? t.intakes[0] : t.intakes;
    if (!intake?.email) continue;
    row("treatment_id", t.id); row("client", `${intake.first_name} <${intake.email}>`);
    row("procedure", t.procedure_name ?? "—");
    console.log(`  ${YELLOW}→ WOULD SEND wellness_checkin${RESET}\n`);
  }
}

// ── cron:aftercare-nudge ─────────────────────────────────────────────────────
async function dryRunAftercareNudge() {
  header("cron:aftercare-nudge  (15:00 UTC)  — nurse nudge for unsent aftercare");

  const now = new Date();
  const oneDayAgo      = new Date(now.getTime() - 864e5).toISOString().split("T")[0];
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 864e5).toISOString().split("T")[0];
  const todayStart = now.toISOString().slice(0, 10) + "T00:00:00.000Z";

  const { data: treatments } = await db
    .from("treatments")
    .select("id, treatment_date, procedure_name, nurse_id, intake_id, intakes(id, first_name)")
    .eq("aftercare_sent", false)
    .eq("archived", false)
    .gte("treatment_date", fourteenDaysAgo)
    .lte("treatment_date", oneDayAgo)
    .not("intake_id", "is", null);

  if (!treatments?.length) { console.log(`  ${GREEN}nothing to send${RESET}`); return; }

  const byNurse = new Map();
  for (const t of treatments) {
    const arr = byNurse.get(t.nurse_id) ?? []; arr.push(t); byNurse.set(t.nurse_id, arr);
  }

  for (const [nurseId, ts] of byNurse.entries()) {
    const { data: existing } = await db.from("message_log").select("id")
      .eq("type", "aftercare_nudge").eq("nurse_id", nurseId)
      .gte("created_at", todayStart).limit(1).single();
    if (existing) { console.log(`  ${DIM}SKIP (already sent today): nurse ${nurseId}${RESET}`); continue; }

    const { data: nurseData } = await db.auth.admin.getUserById(nurseId);
    const nurseEmail = nurseData?.user?.email ?? "(no email)";
    row("nurse_id", nurseId); row("nurse_email", nurseEmail);
    row("unsent clients", ts.length.toString());
    for (const t of ts) {
      const intake = Array.isArray(t.intakes) ? t.intakes[0] : t.intakes;
      console.log(`    ${DIM}· ${intake?.first_name ?? "Client"} — ${t.procedure_name ?? "Treatment"} on ${t.treatment_date}${RESET}`);
    }
    console.log(`  ${YELLOW}→ WOULD SEND aftercare_nudge to nurse${RESET}\n`);
  }
}

// ── Run all ──────────────────────────────────────────────────────────────────
console.log(`${BOLD}AdonisBlue cron dry-run — ${new Date().toUTCString()}${RESET}`);

await dryRunPrepReminders();
await dryRunReminders();
await dryRunReviews();
await dryRunTreatmentReminders();
await dryRunWellnessCheckin();
await dryRunAftercareNudge();

console.log(`\n${BOLD}Done.${RESET}\n`);
