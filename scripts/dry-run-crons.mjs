#!/usr/bin/env node
/**
 * Dry-run: shows what each cron would send for the current data
 * without sending any emails.
 *
 * Usage: node --env-file=.env.local scripts/dry-run-crons.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(url, key);

const BOLD  = "\x1b[1m";
const DIM   = "\x1b[2m";
const CYAN  = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RESET = "\x1b[0m";

function header(title) {
  console.log(`\n${BOLD}${CYAN}${"─".repeat(64)}${RESET}`);
  console.log(`${BOLD}${CYAN}  ${title}${RESET}`);
  console.log(`${CYAN}${"─".repeat(64)}${RESET}`);
}

function row(label, value) {
  console.log(`  ${DIM}${String(label).padEnd(26)}${RESET}${value}`);
}

// ── cron:prep-reminders ──────────────────────────────────────────────────────
async function dryRunPrepReminders() {
  header("cron:prep-reminders  (09:00 UTC)");

  const now = new Date();
  const startDate = new Date(now.getTime() + 24 * 36e5).toISOString().split("T")[0];
  const endDate   = new Date(now.getTime() + 48 * 36e5).toISOString().split("T")[0];

  const { data: treatments, error } = await db
    .from("treatments")
    .select("id, procedure_name, treatment_date, intake_id, nurse_id, intakes(id, first_name, email)")
    .gte("treatment_date", startDate)
    .lte("treatment_date", endDate)
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
  header("cron:reminders  (10:00 UTC)  — 6m/9m backup (no reminder_days on procedure)");

  const now = new Date();
  const sixMonthsAgo  = new Date(now); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const nineMonthsAgo = new Date(now); nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9);

  // Query intakes directly (avoids cross-table join issue with marketing_opt_out)
  const { data: eligibleIntakes, error: intakesError } = await db
    .from("intakes")
    .select("id, first_name, email, nurse_id, reminder_6m_sent, reminder_9m_sent")
    .not("email", "is", null);

  if (intakesError) { console.error("  query error:", intakesError.message); return; }
  if (!eligibleIntakes?.length) { console.log(`  ${GREEN}nothing to send${RESET}`); return; }

  const intakeIds = eligibleIntakes.map(i => i.id);

  const { data: candidateTreatments, error: treatmentsError } = await db
    .from("treatments")
    .select("id, treatment_date, intake_id, procedure_id, nurse_id, procedures(reminder_days)")
    .in("intake_id", intakeIds)
    .eq("archived", false)
    .lte("treatment_date", sixMonthsAgo.toISOString().split("T")[0]);

  if (treatmentsError) { console.error("  query error:", treatmentsError.message); return; }

  // Most recent treatment per intake_id
  const mostRecentByIntake = new Map();
  for (const t of candidateTreatments ?? []) {
    const ex = mostRecentByIntake.get(t.intake_id);
    if (!ex || new Date(t.treatment_date) > new Date(ex.treatment_date)) mostRecentByIntake.set(t.intake_id, t);
  }

  let count = 0;
  for (const intake of eligibleIntakes) {
    const mostRecent = mostRecentByIntake.get(intake.id);
    if (!mostRecent) continue;

    const reminderDays = mostRecent.procedures?.reminder_days;
    if (reminderDays) {
      console.log(`  ${DIM}SKIP (procedure has reminder_days=${reminderDays}): ${intake.first_name}${RESET}`);
      continue;
    }
    const tDate = new Date(mostRecent.treatment_date);
    if (!intake.reminder_6m_sent && tDate <= sixMonthsAgo) {
      row("intake_id", intake.id);
      row("client", `${intake.first_name} <${intake.email}>`);
      row("most_recent_treatment", mostRecent.treatment_date);
      console.log(`  ${YELLOW}→ WOULD SEND reminder_6m${RESET}\n`); count++;
    }
    if (!intake.reminder_9m_sent && tDate <= nineMonthsAgo) {
      row("intake_id", intake.id);
      row("client", `${intake.first_name} <${intake.email}>`);
      row("most_recent_treatment", mostRecent.treatment_date);
      console.log(`  ${YELLOW}→ WOULD SEND reminder_9m${RESET}\n`); count++;
    }
  }
  if (!count) console.log(`  ${GREEN}nothing to send${RESET}`);
}

// ── cron:reviews ─────────────────────────────────────────────────────────────
async function dryRunReviews() {
  header("cron:reviews  (11:00 UTC)  — most recent treatment 14–30 days ago");

  const now = new Date();
  const fourteenDaysAgo = new Date(now); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const thirtyDaysAgo   = new Date(now); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: allTreatments } = await db
    .from("treatments")
    .select("intake_id, treatment_date")
    .eq("archived", false)
    .not("intake_id", "is", null);

  const mostRecentDateByIntake = new Map();
  for (const t of allTreatments ?? []) {
    const ex = mostRecentDateByIntake.get(t.intake_id);
    if (!ex || t.treatment_date > ex) mostRecentDateByIntake.set(t.intake_id, t.treatment_date);
  }

  const cutStart = thirtyDaysAgo.toISOString().split("T")[0];
  const cutEnd   = fourteenDaysAgo.toISOString().split("T")[0];

  const eligibleIds = [...mostRecentDateByIntake.entries()]
    .filter(([, date]) => date >= cutStart && date <= cutEnd)
    .map(([id]) => id);

  if (!eligibleIds.length) { console.log(`  ${GREEN}nothing to send${RESET}`); return; }

  const { data: intakes } = await db.from("intakes")
    .select("id, first_name, email, nurse_id")
    .in("id", eligibleIds)
    .eq("review_request_sent", false)
    .eq("survey_sent", false)
    .is("review_submitted_at", null)
    .not("email", "is", null);

  if (!intakes?.length) { console.log(`  ${GREEN}nothing to send (all already received review request)${RESET}`); return; }
  for (const i of intakes) {
    row("intake_id", i.id);
    row("client", `${i.first_name ?? "?"} <${i.email}>`);
    row("most_recent_treatment", mostRecentDateByIntake.get(i.id));
    console.log(`  ${YELLOW}→ WOULD SEND review_request${RESET}\n`);
  }
}

// ── cron:treatment-reminders ─────────────────────────────────────────────────
async function dryRunTreatmentReminders() {
  header("cron:treatment-reminders  (12:00 UTC)  — procedure-specific, most recent only");

  const { data: treatments, error } = await db
    .from("treatments")
    .select(`
      id, treatment_date, procedure_name, nurse_id, intake_id, procedure_id,
      intakes(first_name, email),
      procedures(name, reminder_days)
    `)
    .eq("reminder_sent", false)
    .not("procedure_id", "is", null)
    .eq("archived", false);

  if (error) { console.error("  query error:", error.message); return; }
  if (!treatments?.length) { console.log(`  ${GREEN}nothing to send${RESET}`); return; }

  const mostRecentMap = new Map();
  for (const t of treatments) {
    const key = `${t.intake_id}:${t.procedure_id}`;
    const ex = mostRecentMap.get(key);
    if (!ex || new Date(t.treatment_date) > new Date(ex.treatment_date)) mostRecentMap.set(key, t);
  }

  const loserIds = treatments.filter(t => {
    const w = mostRecentMap.get(`${t.intake_id}:${t.procedure_id}`);
    return w && t.id !== w.id;
  }).map(t => t.id);

  if (loserIds.length) {
    console.log(`  ${DIM}Would mark ${loserIds.length} older treatment(s) reminder_sent=true (dedup)${RESET}`);
  }

  const today = new Date();
  let count = 0;
  for (const t of mostRecentMap.values()) {
    const intake = Array.isArray(t.intakes) ? t.intakes[0] : t.intakes;
    if (!intake || intake.marketing_opt_out || !intake.email) continue;
    const rDays = t.procedures?.reminder_days;
    if (!rDays) continue;
    const reminderDate = new Date(new Date(t.treatment_date).getTime() + rDays * 864e5);
    const diff = Math.floor((today - reminderDate) / 864e5);
    if (diff < 0 || diff > 1) continue;
    row("treatment_id", t.id);
    row("client", `${intake?.first_name ?? "?"} <${intake?.email ?? "?"}>`);
    row("procedure", t.procedure_name ?? "—");
    row("reminder_days", rDays);
    console.log(`  ${YELLOW}→ WOULD SEND treatment_reminder${RESET}\n`); count++;
  }
  if (!count) console.log(`  ${GREEN}nothing due today${RESET}`);
}

// ── cron:wellness-checkin ────────────────────────────────────────────────────
async function dryRunWellnessCheckin() {
  header("cron:wellness-checkin  (13:00 UTC)  — 16–40h after aftercare sent");

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
    row("treatment_id", t.id);
    row("client", `${intake.first_name ?? "?"} <${intake.email}>`);
    row("procedure", t.procedure_name ?? "—");
    console.log(`  ${YELLOW}→ WOULD SEND wellness_checkin${RESET}\n`);
  }
}

// ── cron:aftercare-nudge ─────────────────────────────────────────────────────
async function dryRunAftercareNudge() {
  header("cron:aftercare-nudge  (15:00 UTC)  — nurse nudge for unsent aftercare");

  const now = new Date();
  const oneDayAgo       = new Date(now.getTime() - 864e5).toISOString().split("T")[0];
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 864e5).toISOString().split("T")[0];
  const todayStart      = now.toISOString().slice(0, 10) + "T00:00:00.000Z";

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
    const nurseEmail = nurseData?.user?.email ?? "(no email found)";
    row("nurse_id", nurseId);
    row("nurse_email", nurseEmail);
    row("unsent aftercare count", ts.length);
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
