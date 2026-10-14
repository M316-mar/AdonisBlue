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

const BOLD   = "\x1b[1m";
const DIM    = "\x1b[2m";
const CYAN   = "\x1b[36m";
const GREEN  = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED    = "\x1b[31m";
const RESET  = "\x1b[0m";

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

  // Query opted-in intakes directly
  const { data: eligibleIntakes, error: intakesError } = await db
    .from("intakes")
    .select("id, first_name, email, nurse_id")
    .eq("marketing_opt_out", false)
    .not("email", "is", null);

  if (intakesError) { console.error("  query error:", intakesError.message); return; }
  if (!eligibleIntakes?.length) { console.log(`  ${GREEN}nothing to send${RESET}`); return; }

  const intakeIds = eligibleIntakes.map(i => i.id);

  // ALL non-archived treatments (no date filter — needed to detect recent revisits)
  const { data: allTreatments, error: treatmentsError } = await db
    .from("treatments")
    .select("id, treatment_date, intake_id, procedure_id, nurse_id, reminder_6m_sent_at, reminder_9m_sent_at, procedures(reminder_days)")
    .in("intake_id", intakeIds)
    .eq("archived", false);

  if (treatmentsError) { console.error("  query error:", treatmentsError.message); return; }

  // Most recent treatment per intake across ALL dates
  const mostRecentByIntake = new Map();
  for (const t of allTreatments ?? []) {
    const ex = mostRecentByIntake.get(t.intake_id);
    if (!ex || new Date(t.treatment_date) > new Date(ex.treatment_date)) mostRecentByIntake.set(t.intake_id, t);
  }

  let count = 0;
  for (const intake of eligibleIntakes) {
    const mostRecent = mostRecentByIntake.get(intake.id);
    if (!mostRecent) {
      console.log(`  ${DIM}SKIP no non-archived treatment: ${intake.first_name}${RESET}`);
      continue;
    }

    const reminderDays = mostRecent.procedures?.reminder_days;
    if (reminderDays) {
      console.log(`  ${DIM}SKIP (procedure has reminder_days=${reminderDays}): ${intake.first_name}${RESET}`);
      continue;
    }

    const tDate = new Date(mostRecent.treatment_date);

    if (!mostRecent.reminder_6m_sent_at && tDate <= sixMonthsAgo) {
      row("intake_id", intake.id);
      row("client", `${intake.first_name} <${intake.email}>`);
      row("most_recent_treatment", mostRecent.treatment_date.split("T")[0]);
      console.log(`  ${YELLOW}→ WOULD SEND reminder_6m${RESET}\n`); count++;
    }
    if (!mostRecent.reminder_9m_sent_at && tDate <= nineMonthsAgo) {
      row("intake_id", intake.id);
      row("client", `${intake.first_name} <${intake.email}>`);
      row("most_recent_treatment", mostRecent.treatment_date.split("T")[0]);
      console.log(`  ${YELLOW}→ WOULD SEND reminder_9m${RESET}\n`); count++;
    }

    if (tDate > sixMonthsAgo) {
      console.log(`  ${DIM}SKIP recent visit (${mostRecent.treatment_date.split("T")[0]}): ${intake.first_name}${RESET}`);
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
    .eq("marketing_opt_out", false)
    .not("email", "is", null);

  if (!intakes?.length) { console.log(`  ${GREEN}nothing to send (all already received review request or opted out)${RESET}`); return; }
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

  // Fetch opt-out map separately (column not accessible via join from treatments)
  const intakeIds = [...new Set(treatments.map(t => t.intake_id).filter(Boolean))];
  const { data: intakeOptOuts } = await db.from("intakes")
    .select("id, marketing_opt_out")
    .in("id", intakeIds);
  const optOutMap = new Map((intakeOptOuts ?? []).map(i => [i.id, i.marketing_opt_out]));

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
    if (optOutMap.get(t.intake_id)) continue;
    if (!intake?.email) continue;
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

// ── Simulated test cases ──────────────────────────────────────────────────────
function runTestCases() {
  header("SIMULATED TEST CASES  (no DB reads or writes)");

  const now = new Date();
  const sixMonthsAgo  = new Date(now); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const nineMonthsAgo = new Date(now); nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9);

  // Helper: evaluate cron:reminders logic against simulated data
  function evalReminders(label, intake, treatments) {
    console.log(`\n  ${BOLD}Test: ${label}${RESET}`);

    if (intake.marketing_opt_out) {
      console.log(`    reminders:    ${DIM}skip — marketing_opt_out=true${RESET}`);
      console.log(`    reviews:      ${DIM}skip — marketing_opt_out=true${RESET}`);
      // Care emails still send
      const careT = treatments.find(t => !t.archived && t.aftercare_sent && !t.wellness_checkin_sent_at);
      if (careT) {
        console.log(`    wellness-checkin: ${YELLOW}→ WOULD SEND (transactional, ignores opt-out)${RESET}`);
      } else {
        console.log(`    wellness-checkin: ${DIM}skip — no eligible treatment${RESET}`);
      }
      const prepT = treatments.find(t => !t.archived && !t.prep_guide_sent_at);
      if (prepT) {
        console.log(`    prep-reminders:   ${YELLOW}→ WOULD SEND (transactional, ignores opt-out)${RESET}`);
      } else {
        console.log(`    prep-reminders:   ${DIM}skip — no upcoming unprepped treatment${RESET}`);
      }
      return;
    }

    const nonArchived = treatments.filter(t => !t.archived);
    if (!nonArchived.length) {
      console.log(`    reminders:    ${DIM}skip — no non-archived treatments${RESET}`);
      return;
    }

    // Most recent overall
    const mostRecent = nonArchived.sort((a, b) => new Date(b.treatment_date) - new Date(a.treatment_date))[0];
    const tDate = new Date(mostRecent.treatment_date);

    if (mostRecent.reminder_days) {
      console.log(`    reminders:    ${DIM}skip — procedure has reminder_days=${mostRecent.reminder_days}${RESET}`);
    } else if (tDate > sixMonthsAgo) {
      console.log(`    reminders:    ${DIM}skip — most recent visit (${mostRecent.treatment_date}) < 6 months ago${RESET}`);
    } else {
      if (!mostRecent.reminder_6m_sent_at) {
        console.log(`    reminders 6m: ${YELLOW}→ WOULD SEND (most recent: ${mostRecent.treatment_date})${RESET}`);
      }
      if (!mostRecent.reminder_9m_sent_at && tDate <= nineMonthsAgo) {
        console.log(`    reminders 9m: ${YELLOW}→ WOULD SEND (most recent: ${mostRecent.treatment_date})${RESET}`);
      }
      if (mostRecent.reminder_6m_sent_at) {
        console.log(`    reminders 6m: ${DIM}skip — reminder_6m_sent_at already set${RESET}`);
      }
    }
  }

  // ── Case (a): visit 7 months ago + visit 1 month ago → NO reminder ─────────
  evalReminders(
    "(a) 7-month visit + 1-month visit → no reminder",
    { marketing_opt_out: false, email: "test@example.com" },
    [
      { archived: false, treatment_date: new Date(now.getTime() - 7 * 30 * 864e5).toISOString().split("T")[0], reminder_days: null, reminder_6m_sent_at: null, reminder_9m_sent_at: null },
      { archived: false, treatment_date: new Date(now.getTime() - 30 * 864e5).toISOString().split("T")[0], reminder_days: null, reminder_6m_sent_at: null, reminder_9m_sent_at: null },
    ]
  );

  // ── Case (b): only visit 7 months ago, no reminder_days → 6m reminder ─────
  evalReminders(
    "(b) only 7-month visit, no reminder_days → 6m reminder",
    { marketing_opt_out: false, email: "test@example.com" },
    [
      { archived: false, treatment_date: new Date(now.getTime() - 7 * 30 * 864e5).toISOString().split("T")[0], reminder_days: null, reminder_6m_sent_at: null, reminder_9m_sent_at: null },
    ]
  );

  // ── Case (c): opted-out client → no reminders/reviews, but still gets check-in
  const optedOutIntake = { marketing_opt_out: true, email: "opteout@example.com" };
  const optedOutTreatments = [
    {
      archived: false,
      treatment_date: new Date(now.getTime() - 17 * 3600_000).toISOString(), // 17h ago
      aftercare_sent: true,
      wellness_checkin_sent_at: null,
      prep_guide_sent_at: "already-sent",
    }
  ];
  evalReminders(
    "(c) opted-out client → no reminders/reviews, still gets wellness check-in",
    optedOutIntake,
    optedOutTreatments
  );

  console.log();
}

// ── Run all ──────────────────────────────────────────────────────────────────
console.log(`${BOLD}AdonisBlue cron dry-run — ${new Date().toUTCString()}${RESET}`);

await dryRunPrepReminders();
await dryRunReminders();
await dryRunReviews();
await dryRunTreatmentReminders();
await dryRunWellnessCheckin();
await dryRunAftercareNudge();
runTestCases();

console.log(`\n${BOLD}Done.${RESET}\n`);
