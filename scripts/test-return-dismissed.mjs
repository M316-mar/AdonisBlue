#!/usr/bin/env node
/**
 * Integration tests for return_dismissed_at across three places:
 * 1. GET /api/return-clients — dismissed treatments must not appear
 * 2. PATCH /api/return-clients dismiss/undismiss/change_date actions
 * 3. cron/treatment-reminders — dismissed treatments are skipped
 * 4. cron/return-reminder — dismissed treatments are skipped
 *
 * Requires TEST_NURSE_EMAIL / TEST_NURSE_PASSWORD in .env.local.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

const envPath = resolve(process.cwd(), ".env.local");
let env = {};
try {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
} catch { /* no .env.local — rely on process.env */ }

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const testEmail = env.TEST_NURSE_EMAIL || process.env.TEST_NURSE_EMAIL;
const testPassword = env.TEST_NURSE_PASSWORD || process.env.TEST_NURSE_PASSWORD;
const cronSecret = env.CRON_SECRET || process.env.CRON_SECRET;

const BASE_URL = env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

let passed = 0;
let failed = 0;

function pass(msg) { process.stdout.write(`  ✓ ${msg}\n`); passed++; }
function fail(msg) { process.stderr.write(`  ✗ ${msg}\n`); failed++; }

async function setup() {
  if (!supabaseUrl || !anonKey || !serviceKey || !testEmail || !testPassword) {
    process.stdout.write("  ⚠ Missing env — skipping return-dismissed tests\n");
    process.exit(0);
  }

  const anon = createClient(supabaseUrl, anonKey);
  const { data: authData, error: authErr } = await anon.auth.signInWithPassword({ email: testEmail, password: testPassword });
  if (!authData?.user || authErr) {
    process.stderr.write(`  ✗ Could not sign in as test nurse: ${authErr?.message}\n`);
    process.exit(1);
  }
  const token = authData.session.access_token;
  const nurseId = authData.user.id;

  const sb = createClient(supabaseUrl, serviceKey);

  // Find a procedure with reminder_days set
  const { data: proc } = await sb
    .from("procedures")
    .select("id, reminder_days")
    .eq("nurse_id", nurseId)
    .not("reminder_days", "is", null)
    .limit(1)
    .maybeSingle();

  if (!proc?.id) {
    process.stdout.write("  ⚠ No procedure with reminder_days found — skipping return-dismissed tests\n");
    process.exit(0);
  }

  // Find or create a test intake
  let intakeId;
  const { data: existingIntake } = await sb
    .from("intakes")
    .select("id")
    .eq("nurse_id", nurseId)
    .eq("first_name", "Device Check Test")
    .limit(1)
    .maybeSingle();
  if (existingIntake) {
    intakeId = existingIntake.id;
  } else {
    const { data: newIntake, error: intakeErr } = await sb
      .from("intakes")
      .insert({ nurse_id: nurseId, first_name: "Device Check Test" })
      .select("id")
      .single();
    if (intakeErr || !newIntake) {
      process.stderr.write(`  ✗ Could not insert test intake: ${intakeErr?.message}\n`);
      process.exit(1);
    }
    intakeId = newIntake.id;
  }

  // Create a treatment that SHOULD appear in return-clients (due date = today + 7 days)
  const reminderDays = proc.reminder_days;
  const targetDueDate = new Date();
  targetDueDate.setUTCDate(targetDueDate.getUTCDate() + 7);
  const treatmentDate = new Date(targetDueDate);
  treatmentDate.setUTCDate(treatmentDate.getUTCDate() - reminderDays);
  const treatmentDateStr = treatmentDate.toISOString().slice(0, 10);

  const { data: treatment, error: insertErr } = await sb
    .from("treatments")
    .insert({
      nurse_id: nurseId,
      intake_id: intakeId,
      treatment_date: treatmentDateStr,
      procedure_id: proc.id,
      procedure_name: "Test Procedure",
      reminder_sent: false,
      archived: false,
    })
    .select("id")
    .single();

  if (insertErr || !treatment) {
    process.stderr.write(`  ✗ Could not insert test treatment: ${insertErr?.message}\n`);
    process.exit(1);
  }
  const treatmentId = treatment.id;

  return { sb, token, nurseId, treatmentId };
}

async function runTests() {
  process.stdout.write("\nReturn dismissed tests\n\n");

  const { sb, token, nurseId, treatmentId } = await setup();

  // ── Test 1: treatment appears in GET before dismissal ──────────────────────
  {
    const res = await fetch(`${BASE_URL}/api/return-clients`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    const found = (json.clients ?? []).some((c) => c.treatment_id === treatmentId);
    if (found) {
      pass("GET /api/return-clients: test treatment appears before dismissal");
    } else {
      fail("GET /api/return-clients: test treatment should appear before dismissal");
    }
  }

  // ── Test 2: PATCH dismiss removes treatment from list ──────────────────────
  {
    const res = await fetch(`${BASE_URL}/api/return-clients`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ treatment_id: treatmentId, action: "dismiss" }),
    });
    if (!res.ok) {
      fail(`PATCH dismiss: expected 200, got ${res.status}`);
    } else {
      const listRes = await fetch(`${BASE_URL}/api/return-clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await listRes.json();
      const found = (json.clients ?? []).some((c) => c.treatment_id === treatmentId);
      if (!found) {
        pass("PATCH dismiss: treatment no longer appears in GET after dismissal");
      } else {
        fail("PATCH dismiss: treatment still appears in GET after dismissal");
      }
    }
    // Verify return_dismissed_at is set in DB
    const { data: row } = await sb
      .from("treatments")
      .select("return_dismissed_at")
      .eq("id", treatmentId)
      .single();
    if (row?.return_dismissed_at) {
      pass("PATCH dismiss: return_dismissed_at is set in DB");
    } else {
      fail("PATCH dismiss: return_dismissed_at not set in DB");
    }
  }

  // ── Test 3: cron/treatment-reminders skips dismissed treatment ─────────────
  if (cronSecret) {
    // Reset reminder_sent so the cron would normally process it
    await sb.from("treatments").update({ reminder_sent: false }).eq("id", treatmentId);
    const res = await fetch(`${BASE_URL}/api/cron/treatment-reminders`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const { data: afterRow } = await sb
      .from("treatments")
      .select("reminder_sent")
      .eq("id", treatmentId)
      .single();
    if (!afterRow?.reminder_sent) {
      pass("cron/treatment-reminders: dismissed treatment was not marked reminder_sent");
    } else {
      fail("cron/treatment-reminders: dismissed treatment was incorrectly processed");
    }
  } else {
    pass("cron/treatment-reminders: skipped (no CRON_SECRET in env)");
  }

  // ── Test 4: PATCH undismiss restores treatment ─────────────────────────────
  {
    const res = await fetch(`${BASE_URL}/api/return-clients`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ treatment_id: treatmentId, action: "undismiss" }),
    });
    if (!res.ok) {
      fail(`PATCH undismiss: expected 200, got ${res.status}`);
    } else {
      const listRes = await fetch(`${BASE_URL}/api/return-clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await listRes.json();
      const found = (json.clients ?? []).some((c) => c.treatment_id === treatmentId);
      if (found) {
        pass("PATCH undismiss: treatment reappears in GET after undismiss");
      } else {
        fail("PATCH undismiss: treatment did not reappear after undismiss");
      }
    }
  }

  // ── Test 5: PATCH change_date updates planned_return_at ───────────────────
  {
    const newDate = new Date();
    newDate.setUTCDate(newDate.getUTCDate() + 20);
    const newDateStr = newDate.toISOString().slice(0, 10);
    const res = await fetch(`${BASE_URL}/api/return-clients`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ treatment_id: treatmentId, action: "change_date", planned_date: newDateStr }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      fail(`PATCH change_date: expected 200, got ${res.status}: ${errBody}`);
    } else {
      const { data: row } = await sb
        .from("treatments")
        .select("planned_return_at, planned_reminder_sent_at")
        .eq("id", treatmentId)
        .single();
      if (row?.planned_return_at === newDateStr && row?.planned_reminder_sent_at === null) {
        pass("PATCH change_date: planned_return_at updated and planned_reminder_sent_at reset to null");
      } else {
        fail(`PATCH change_date: got planned_return_at=${row?.planned_return_at}, planned_reminder_sent_at=${row?.planned_reminder_sent_at}`);
      }
    }
  }

  // ── Test 6: dismissed_clients in GET lists the removed row ───────────────
  {
    // Dismiss first
    await fetch(`${BASE_URL}/api/return-clients`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ treatment_id: treatmentId, action: "dismiss" }),
    });
    const listRes = await fetch(`${BASE_URL}/api/return-clients`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await listRes.json();
    const inDismissed = (json.dismissed_clients ?? []).some((c) => c.treatment_id === treatmentId);
    const notInActive = !(json.clients ?? []).some((c) => c.treatment_id === treatmentId);
    if (inDismissed && notInActive) {
      pass("GET dismissed_clients: removed treatment appears in dismissed_clients, not in clients");
    } else {
      fail(`GET dismissed_clients: inDismissed=${inDismissed}, notInActive=${notInActive}`);
    }
  }

  // ── Test 7: Put back via undismiss removes from dismissed_clients ─────────
  {
    await fetch(`${BASE_URL}/api/return-clients`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ treatment_id: treatmentId, action: "undismiss" }),
    });
    const listRes = await fetch(`${BASE_URL}/api/return-clients`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await listRes.json();
    const stillDismissed = (json.dismissed_clients ?? []).some((c) => c.treatment_id === treatmentId);
    const backInActive = (json.clients ?? []).some((c) => c.treatment_id === treatmentId);
    if (!stillDismissed && backInActive) {
      pass("Put back: treatment removed from dismissed_clients and restored to clients");
    } else {
      fail(`Put back: stillDismissed=${stillDismissed}, backInActive=${backInActive}`);
    }
    // Verify reminder_sent is still false (client can still get their reminder)
    const { data: row } = await sb
      .from("treatments")
      .select("reminder_sent, return_dismissed_at")
      .eq("id", treatmentId)
      .single();
    if (!row?.return_dismissed_at && !row?.reminder_sent) {
      pass("Put back: return_dismissed_at cleared, reminder_sent still false (reminder can still fire)");
    } else {
      fail(`Put back: return_dismissed_at=${row?.return_dismissed_at}, reminder_sent=${row?.reminder_sent}`);
    }
  }

  // ── Test 8: set_return_plan clears return_dismissed_at ────────────────────
  {
    // Dismiss first
    await sb.from("treatments").update({ return_dismissed_at: new Date().toISOString() }).eq("id", treatmentId);
    // Set a return plan — should clear dismissal
    const futureDate = new Date();
    futureDate.setUTCDate(futureDate.getUTCDate() + 30);
    const futureDateStr = futureDate.toISOString().slice(0, 10);
    const res = await fetch(`${BASE_URL}/api/treatments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: treatmentId,
        action: "set_return_plan",
        planned_return_at: futureDateStr,
        reminder_lead_days: 7,
        return_reason: "Touch-up",
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      fail(`set_return_plan: expected 200, got ${res.status}: ${errBody}`);
    } else {
      const { data: row } = await sb
        .from("treatments")
        .select("return_dismissed_at, planned_return_at")
        .eq("id", treatmentId)
        .single();
      if (!row?.return_dismissed_at && row?.planned_return_at === futureDateStr) {
        pass("set_return_plan: clears return_dismissed_at and sets planned_return_at");
      } else {
        fail(`set_return_plan: return_dismissed_at=${row?.return_dismissed_at}, planned_return_at=${row?.planned_return_at}`);
      }
      // Also verify she shows up in active list again
      const listRes = await fetch(`${BASE_URL}/api/return-clients`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await listRes.json();
      const backInActive = (json.clients ?? []).some((c) => c.treatment_id === treatmentId);
      if (backInActive) {
        pass("set_return_plan: client restored to active return list");
      } else {
        fail("set_return_plan: client did not reappear in active return list");
      }
    }
  }

  // ── Test 9: change_date clears return_dismissed_at ────────────────────────
  {
    // Dismiss first
    await sb.from("treatments").update({ return_dismissed_at: new Date().toISOString() }).eq("id", treatmentId);
    const newDate2 = new Date();
    newDate2.setUTCDate(newDate2.getUTCDate() + 25);
    const newDate2Str = newDate2.toISOString().slice(0, 10);
    const res = await fetch(`${BASE_URL}/api/return-clients`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ treatment_id: treatmentId, action: "change_date", planned_date: newDate2Str }),
    });
    if (!res.ok) {
      fail(`change_date clears dismissal: expected 200, got ${res.status}`);
    } else {
      const { data: row } = await sb
        .from("treatments")
        .select("return_dismissed_at")
        .eq("id", treatmentId)
        .single();
      if (!row?.return_dismissed_at) {
        pass("change_date: clears return_dismissed_at");
      } else {
        fail(`change_date: return_dismissed_at still set: ${row?.return_dismissed_at}`);
      }
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────
  await sb.from("treatments").delete().eq("id", treatmentId);

  // ── Summary ────────────────────────────────────────────────────────────────
  process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  process.stderr.write(`  ✗ Unexpected error: ${e.message}\n`);
  process.exit(1);
});
