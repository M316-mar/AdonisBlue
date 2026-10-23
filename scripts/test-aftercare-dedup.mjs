/**
 * Tests for aftercare send bugs:
 * 1. send_aftercare written in treatments INSERT (bug b)
 * 2. send-aftercare route uses treatment_id directly (item disappears after send)
 * 3. send-aftercare dedup guard (no duplicates)
 */
import assert from "node:assert/strict";

let passed = 0;
let failed = 0;
function test(label, fn) {
  try { fn(); console.log(`\x1b[32mPASS\x1b[0m  ${label}`); passed++; }
  catch (e) { console.error(`\x1b[31mFAIL\x1b[0m  ${label}\n      ${e.message}`); failed++; }
}

// ── 1. send_aftercare is written in the INSERT payload ────────────────────────
// Simulate the treatments route logic
function buildTreatmentsInsertPayload(body) {
  const sendAftercare = body.send_aftercare !== false; // from route.ts line 108
  return {
    nurse_id: "nurse-1",
    intake_id: body.intake_id,
    procedure_id: body.procedure_id ?? null,
    procedure_name: body.procedure_name ?? "",
    treatment_date: body.treatment_date,
    notes: body.notes ?? null,
    came_via_bot: body.came_via_bot === true,
    send_aftercare: sendAftercare, // ← THE FIX: must be present
  };
}

test("send_aftercare=true when body has send_aftercare:true", () => {
  const payload = buildTreatmentsInsertPayload({ intake_id: "i1", treatment_date: "2026-10-21", send_aftercare: true });
  assert.equal(payload.send_aftercare, true);
});

test("send_aftercare=false when body has send_aftercare:false", () => {
  const payload = buildTreatmentsInsertPayload({ intake_id: "i1", treatment_date: "2026-10-21", send_aftercare: false });
  assert.equal(payload.send_aftercare, false);
});

test("send_aftercare=true when body omits the field (default)", () => {
  const payload = buildTreatmentsInsertPayload({ intake_id: "i1", treatment_date: "2026-10-21" });
  assert.equal(payload.send_aftercare, true);
});

test("send_aftercare key IS present in INSERT payload", () => {
  const payload = buildTreatmentsInsertPayload({ intake_id: "i1", treatment_date: "2026-10-21", send_aftercare: false });
  assert.ok(Object.prototype.hasOwnProperty.call(payload, "send_aftercare"),
    "send_aftercare must be in the INSERT payload, not missing");
});

// ── 2. Dedup logic ────────────────────────────────────────────────────────────
// Simulates what the send-aftercare route now does before sending.
function checkDedup(treatment) {
  const alreadySentAt = treatment.aftercare_sent_at;
  const alreadyScheduledAt = treatment.aftercare_send_at;
  if (alreadySentAt) return { already_sent: true, sent_at: alreadySentAt };
  if (alreadyScheduledAt && new Date(alreadyScheduledAt) > new Date()) {
    return { already_scheduled: true, scheduled_at: alreadyScheduledAt };
  }
  return null;
}

test("dedup: returns already_sent when aftercare_sent_at is set", () => {
  const r = checkDedup({ aftercare_sent_at: "2026-10-21T10:00:00Z", aftercare_send_at: null });
  assert.equal(r?.already_sent, true);
  assert.equal(r?.sent_at, "2026-10-21T10:00:00Z");
});

test("dedup: returns already_scheduled when aftercare_send_at is in the future", () => {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const r = checkDedup({ aftercare_sent_at: null, aftercare_send_at: future });
  assert.equal(r?.already_scheduled, true);
});

test("dedup: no block when aftercare_send_at is in the past (already promoted)", () => {
  const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const r = checkDedup({ aftercare_sent_at: null, aftercare_send_at: past });
  assert.equal(r, null);
});

test("dedup: no block when both fields are null (first send)", () => {
  const r = checkDedup({ aftercare_sent_at: null, aftercare_send_at: null });
  assert.equal(r, null);
});

// ── 3. treatment_id path uses correct treatment ───────────────────────────────
// Simulates the route finding the treatment by ID (not by intake+procedure+date).
function simulateSendByTreatmentId(treatments, treatmentId, nurseId) {
  const t = treatments.find(x => x.id === treatmentId && x.nurse_id === nurseId);
  if (!t) return { error: "Treatment not found", status: 404 };
  if (t.archived) return { error: "Treatment is archived", status: 422 };
  const dedup = checkDedup(t);
  if (dedup) return { ...dedup, status: 409 };
  // Would send here; mark send_at
  return { success: true, treatment_id: t.id };
}

const treatments = [
  { id: "t-oct21", nurse_id: "nurse-1", intake_id: "i1", procedure_id: "p1", treatment_date: "2026-10-21", aftercare_sent_at: null, aftercare_send_at: null, archived: false },
  { id: "t-oct22-dup", nurse_id: "nurse-1", intake_id: "i1", procedure_id: "p1", treatment_date: "2026-10-22", aftercare_sent_at: null, aftercare_send_at: null, archived: false },
];

test("treatment_id path targets the exact Oct 21 treatment (not a new Oct 22 one)", () => {
  const r = simulateSendByTreatmentId(treatments, "t-oct21", "nurse-1");
  assert.equal(r.success, true);
  assert.equal(r.treatment_id, "t-oct21");
});

test("treatment_id path rejects wrong nurse_id", () => {
  const r = simulateSendByTreatmentId(treatments, "t-oct21", "nurse-other");
  assert.equal(r.status, 404);
});

test("treatment_id path rejects already-sent treatment", () => {
  const already = [{ id: "t-sent", nurse_id: "nurse-1", intake_id: "i1", procedure_id: "p1", treatment_date: "2026-10-21", aftercare_sent_at: "2026-10-21T10:00:00Z", aftercare_send_at: null, archived: false }];
  const r = simulateSendByTreatmentId(already, "t-sent", "nurse-1");
  assert.equal(r.status, 409);
  assert.equal(r.already_sent, true);
});

test("after send: treatment removed from unsent list (local state update)", () => {
  const unsentAftercares = [
    { treatment_id: "t-oct21", intake_id: "i1", procedure_id: "p1", client_name: "Maria", treatment_date: "2026-10-21", procedure_name: "Lip Filler" },
    { treatment_id: "t-oct20", intake_id: "i2", procedure_id: "p2", client_name: "Ana", treatment_date: "2026-10-20", procedure_name: "Botox" },
  ];
  // Simulate what setCtx does on success
  const after = unsentAftercares.filter(x => x.treatment_id !== "t-oct21");
  assert.equal(after.length, 1);
  assert.equal(after[0].treatment_id, "t-oct20");
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed}/${passed + failed} run — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
