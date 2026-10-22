#!/usr/bin/env node
/**
 * test-healing-upsert.mjs
 *
 * Proves that a normal follow-up message after an emergency does NOT clear
 * the flagged/status fields in healing_chats.
 *
 * The test simulates the upsert payload logic from app/api/healing/route.ts
 * and merges it the same way Supabase does (onConflict: "treatment_id" —
 * only the fields present in the payload are overwritten; absent fields
 * keep their current DB value).
 *
 * Run: node scripts/test-healing-upsert.mjs
 * Any failure exits 1 so `npm run check` fails.
 */

// ── Inline the route's upsert payload builder (must match route exactly) ────

function buildUpsertPayload({ treatment_id, nurse_id, client_name, messages, clientPhoneInput, isFlagged, lastUserMessage }) {
  const payload = {
    treatment_id,
    nurse_id,
    client_name,
    messages,
    updated_at: new Date().toISOString(),
    client_phone: clientPhoneInput,
  };
  if (isFlagged) {
    payload.flagged = true;
    payload.flagged_message = lastUserMessage.slice(0, 500);
    payload.status = "active";
  }
  return payload;
}

// Simulate what Supabase does on upsert (onConflict="treatment_id"):
// merge the new payload INTO the existing row — only overwrite keys that are present.
function simulateUpsert(currentRow, payload) {
  return { ...currentRow, ...payload };
}

// ── Tests ────────────────────────────────────────────────────────────────────

const BOLD = "\x1b[1m", RED = "\x1b[31m", GREEN = "\x1b[32m", RESET = "\x1b[0m";
let pass = 0, fail = 0;

function check(label, actual, expected) {
  const ok = actual === expected;
  if (ok) pass++; else fail++;
  const tag = ok ? `${GREEN}PASS${RESET}` : `${RED}${BOLD}FAIL${RESET}`;
  const detail = ok ? "" : `  (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`;
  console.log(`${tag}  ${label}${detail}`);
}

// ── Shared fixture ───────────────────────────────────────────────────────────

const BASE = { treatment_id: "abc", nurse_id: "nurse-1", clientPhoneInput: null };
const EMERGENCY_MSG = "my lip is turning white";
const FOLLOWUP_MSG  = "thank you";

// ── Test 1: emergency message → payload includes flagged=true, status="active" ──

const emergencyPayload = buildUpsertPayload({
  ...BASE,
  client_name: "Maria",
  messages: [{ role: "user", content: EMERGENCY_MSG }],
  isFlagged: true,
  lastUserMessage: EMERGENCY_MSG,
});

check("emergency payload: flagged=true",         emergencyPayload.flagged,         true);
check("emergency payload: status='active'",       emergencyPayload.status,          "active");
check("emergency payload: flagged_message set",   typeof emergencyPayload.flagged_message, "string");

// ── Test 2: non-emergency message → payload does NOT include flagged or status ──

const followupPayload = buildUpsertPayload({
  ...BASE,
  client_name: "Maria",
  messages: [
    { role: "user",      content: EMERGENCY_MSG },
    { role: "assistant", content: "Please call 911." },
    { role: "user",      content: FOLLOWUP_MSG },
  ],
  isFlagged: false,
  lastUserMessage: FOLLOWUP_MSG,
});

check("follow-up payload: 'flagged' key absent",         !("flagged"         in followupPayload), true);
check("follow-up payload: 'status' key absent",          !("status"          in followupPayload), true);
check("follow-up payload: 'flagged_message' key absent", !("flagged_message" in followupPayload), true);

// ── Test 3: simulate DB state — alert survives follow-up upsert ──────────────
//
// Scenario: DB row is empty → emergency upsert → follow-up upsert.
// After both upserts, flagged must still be true and status must still be "active".

const emptyRow    = { treatment_id: "abc", flagged: null, status: null, flagged_message: null };
const afterAlert  = simulateUpsert(emptyRow,       emergencyPayload);
const afterFollowup = simulateUpsert(afterAlert,   followupPayload);

check("DB after emergency upsert: flagged=true",        afterAlert.flagged,    true);
check("DB after emergency upsert: status='active'",     afterAlert.status,     "active");
check("DB after follow-up upsert: flagged still true",  afterFollowup.flagged, true);
check("DB after follow-up upsert: status still 'active'", afterFollowup.status, "active");
check("DB after follow-up upsert: messages updated",
  afterFollowup.messages.length, 3);

// ── Test 4: second emergency in same chat also stays active ──────────────────

const secondEmergency  = buildUpsertPayload({
  ...BASE,
  client_name: "Maria",
  messages: [
    { role: "user",      content: EMERGENCY_MSG },
    { role: "assistant", content: "Please call 911." },
    { role: "user",      content: "I still feel bad" },
  ],
  isFlagged: true,
  lastUserMessage: "I still feel bad",
});

const afterSecond = simulateUpsert(afterFollowup, secondEmergency);
check("second emergency upsert: flagged=true",    afterSecond.flagged, true);
check("second emergency upsert: status='active'", afterSecond.status, "active");

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${pass}/${pass + fail} passed${fail > 0 ? ` — ${BOLD}${RED}${fail} FAILED${RESET}` : ""}`);
if (fail > 0) process.exit(1);
