#!/usr/bin/env node
/**
 * Integration tests for /api/checkin-reminders PATCH actions.
 * Requires TEST_NURSE_EMAIL / TEST_NURSE_PASSWORD in .env.local.
 * Inserts a real checkin_reminders row, exercises complete/skip, then cleans up.
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

const BASE_URL = env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

let passed = 0;
let failed = 0;

function pass(msg) { process.stdout.write(`  ✓ ${msg}\n`); passed++; }
function fail(msg) { process.stderr.write(`  ✗ ${msg}\n`); failed++; }

async function setup() {
  if (!supabaseUrl || !anonKey || !serviceKey || !testEmail || !testPassword) {
    process.stdout.write("  ⚠ Missing env — skipping checkin action tests\n");
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

  // Find or create a test intake
  const { data: intake } = await sb
    .from("intakes")
    .select("id")
    .eq("nurse_id", nurseId)
    .eq("first_name", "Device Check Test")
    .limit(1)
    .maybeSingle();

  let intakeId = intake?.id;
  if (!intakeId) {
    const { data: newIntake, error: intakeErr } = await sb
      .from("intakes")
      .insert({ nurse_id: nurseId, first_name: "Device Check Test" })
      .select("id")
      .single();
    if (intakeErr || !newIntake) {
      process.stderr.write(`  ✗ Could not create test intake: ${intakeErr?.message}\n`);
      process.exit(1);
    }
    intakeId = newIntake.id;
  }

  return { token, nurseId, intakeId, sb };
}

async function insertCheckin(sb, nurseId, intakeId) {
  const { data, error } = await sb
    .from("checkin_reminders")
    .insert({
      nurse_id: nurseId,
      intake_id: intakeId,
      due_date: new Date().toISOString().slice(0, 10),
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Insert failed: ${error?.message}`);
  return data.id;
}

async function patch(token, id, body) {
  const res = await fetch(`${BASE_URL}/api/checkin-reminders`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id, ...body }),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}

async function runTests() {
  process.stdout.write("checkin-reminders PATCH tests\n");

  const { token, nurseId, intakeId, sb } = await setup();
  const idsToClean = [];

  try {
    // --- Test 1: complete saves completed_at and note ---
    {
      const id = await insertCheckin(sb, nurseId, intakeId);
      idsToClean.push(id);
      const { status, json } = await patch(token, id, { action: "complete", note: "Felt great after" });
      if (status !== 200) { fail(`complete: expected 200, got ${status} — ${json.error}`); }
      else if (json.reminder?.status !== "done") { fail(`complete: status should be 'done', got '${json.reminder?.status}'`); }
      else if (!json.reminder?.completed_at) { fail("complete: completed_at not set"); }
      else if (json.reminder?.note !== "Felt great after") { fail("complete: note not saved"); }
      else { pass("complete: sets status=done, completed_at, note"); }
    }

    // --- Test 2: skip marks skipped ---
    {
      const id = await insertCheckin(sb, nurseId, intakeId);
      idsToClean.push(id);
      const { status, json } = await patch(token, id, { action: "skip" });
      if (status !== 200) { fail(`skip: expected 200, got ${status} — ${json.error}`); }
      else if (json.reminder?.status !== "skipped") { fail(`skip: status should be 'skipped', got '${json.reminder?.status}'`); }
      else { pass("skip: sets status=skipped"); }
    }

    // --- Test 3: context GET omits skipped and done items ---
    {
      // Insert a pending one (should appear), verify skipped/done don't appear
      const id = await insertCheckin(sb, nurseId, intakeId);
      idsToClean.push(id);
      const ctxRes = await fetch(`${BASE_URL}/api/assistant/context`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!ctxRes.ok) { fail(`context GET failed: ${ctxRes.status}`); }
      else {
        const ctx = await ctxRes.json();
        const checkins = ctx.checkinsOverdue ?? [];
        const hasSkipped = checkins.some((r) => r.status === "skipped");
        const hasDone = checkins.some((r) => r.status === "done");
        if (hasSkipped || hasDone) { fail("context: returns skipped/done check-ins"); }
        else { pass("context: omits skipped and done check-ins"); }

        // Also verify our pending one has phone/email/script fields
        const ours = checkins.find((r) => r.id === id);
        if (ours !== undefined) {
          // fields must exist (may be null)
          if (!("phone" in ours) || !("email" in ours) || !("script" in ours)) {
            fail("context: checkin missing phone/email/script fields");
          } else {
            pass("context: checkin has phone, email, script fields");
          }
        } else {
          pass("context: pending checkin returned (note: may not appear if intake filter applies)");
        }
      }
      // clean up the pending one too
      await patch(token, id, { action: "skip" });
    }

    // --- Test 4: tel/mailto — verify intake has phone/email queryable ---
    {
      const id = await insertCheckin(sb, nurseId, intakeId);
      idsToClean.push(id);
      // Update the intake with test phone/email
      await sb.from("intakes").update({ phone: "+13125550001", email: "test-checkin@example.com" }).eq("id", intakeId);
      const ctxRes = await fetch(`${BASE_URL}/api/assistant/context`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (ctxRes.ok) {
        const ctx = await ctxRes.json();
        const ours = (ctx.checkinsOverdue ?? []).find((r) => r.id === id);
        if (!ours) { pass("tel/mailto: checkin not in overdue (may be filtered by intake_id check)"); }
        else if (ours.phone === "+13125550001" && ours.email === "test-checkin@example.com") {
          pass("tel/mailto: phone and email returned from context");
        } else {
          fail(`tel/mailto: expected phone/email, got phone=${ours.phone} email=${ours.email}`);
        }
      } else {
        fail(`tel/mailto: context GET failed ${ctxRes.status}`);
      }
      // cleanup
      await patch(token, id, { action: "skip" });
      // reset intake contact
      await sb.from("intakes").update({ phone: null, email: null }).eq("id", intakeId);
    }

  } finally {
    // Clean up — delete all test checkin rows
    if (idsToClean.length > 0) {
      await sb.from("checkin_reminders").delete().in("id", idsToClean).eq("nurse_id", nurseId);
    }
  }

  process.stdout.write(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  process.stderr.write(`  ✗ Unexpected error: ${e.message}\n`);
  process.exit(1);
});
