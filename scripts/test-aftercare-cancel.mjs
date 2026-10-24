// Test script for aftercare-cancel logic
// Run from project root: node scripts/test-aftercare-cancel.mjs
//
// Verifies:
// 1. cancel called with the right provider_id when a scheduled row exists
// 2. cancel success → message_log updated, treatment cleared, ok: true
// 3. no provider_id → returns error without calling Resend
// 4. Resend cancel fails (non-422) → returns error, does NOT clear treatment
// 5. Resend cancel fails with 422 (already sent) → returns already_sent: true

const BOLD = "\x1b[1m", RED = "\x1b[31m", GREEN = "\x1b[32m", RESET = "\x1b[0m";
let pass = 0, fail = 0;
function label(ok, msg) {
  if (ok) pass++; else fail++;
  const tag = ok ? `${GREEN}PASS${RESET}` : `${RED}${BOLD}FAIL${RESET}`;
  console.log(`${tag}  ${msg}`);
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

function makeDb({ providerId, aftercare_sent_at = null, updateFails = false } = {}) {
  const logRowUpdated = { count: 0 };
  const treatmentUpdated = { count: 0, value: null };
  return {
    logRowUpdated,
    treatmentUpdated,
    from(table) {
      const self = this;
      return {
        select() { return this; },
        eq() { return this; },
        order() { return this; },
        limit() { return this; },
        single() {
          if (table === "treatments") {
            return Promise.resolve({ data: { id: "t1", nurse_id: "n1", aftercare_send_at: "2026-10-24T14:23:00Z", aftercare_sent_at }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        maybeSingle() {
          if (table === "message_log") {
            return Promise.resolve({ data: providerId ? { id: "log1", provider_id: providerId } : null, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        update(fields) {
          return {
            eq() { return this; },
            then(resolve) {
              if (table === "treatments") {
                treatmentUpdated.count++;
                treatmentUpdated.value = fields;
                if (updateFails) return resolve({ error: { message: "db error" } });
              }
              if (table === "message_log") logRowUpdated.count++;
              return resolve({ error: null });
            },
          };
        },
        insert() { return { then: (r) => r({ error: null }) }; },
      };
    },
  };
}

function makeResend({ cancelError = null } = {}) {
  const calls = [];
  return {
    calls,
    emails: {
      cancel(id) {
        calls.push(id);
        return Promise.resolve({ error: cancelError, data: cancelError ? null : { object: "email" } });
      },
    },
  };
}

// Simplified version of the cancel logic (mirrors route.ts)
async function runCancelLogic({ providerId, cancelError = null, updateFails = false, aftercare_sent_at = null }) {
  const db = makeDb({ providerId, updateFails, aftercare_sent_at });
  const resend = makeResend({ cancelError });
  const logErrors = [];

  async function logError(area, msg) { logErrors.push({ area, msg }); }
  async function promoteScheduledAftercares() {}

  // Fetch treatment
  const { data: treatment } = await db.from("treatments").select().eq().single();
  if (treatment.aftercare_sent_at) {
    return { result: { ok: false, already_sent: true }, db, resend, logErrors };
  }

  // Find log row
  const { data: logRow } = await db.from("message_log").select().eq().eq().order().limit().maybeSingle();
  const pid = logRow?.provider_id ?? null;

  if (!pid) {
    await logError("aftercare-cancel", `No provider_id found`);
    return { result: { ok: false, error: "Couldn't cancel — it may still send. Contact support." }, db, resend, logErrors };
  }

  // Call Resend
  const { error: cancelErr } = await resend.emails.cancel(pid);

  if (cancelErr) {
    const alreadySent = cancelErr.statusCode === 422 || cancelErr.name === "validation_error";
    await logError("aftercare-cancel", `Resend cancel failed: ${cancelErr.message}`);
    if (alreadySent) {
      await promoteScheduledAftercares();
      return { result: { ok: false, already_sent: true, sent_at: "2026-10-24T14:23:00Z" }, db, resend, logErrors };
    }
    return { result: { ok: false, error: "Couldn't cancel — it may still send. Try again." }, db, resend, logErrors };
  }

  // Success — update log + treatment
  await db.from("message_log").update({ status: "canceled" }).eq().eq().eq();
  const { error: updateErr } = await db.from("treatments").update({ aftercare_send_at: null }).eq().then(r => r);
  if (updateErr) {
    await logError("aftercare-cancel", updateErr.message);
    return { result: { ok: false, error: "Failed to update treatment" }, db, resend, logErrors };
  }

  return { result: { ok: true }, db, resend, logErrors };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

// 1. Happy path: cancel called with the right id, ok: true
{
  const { result, resend, db } = await runCancelLogic({ providerId: "resend-abc-123" });
  label(result.ok === true, "happy path: result.ok === true");
  label(resend.calls.length === 1, "happy path: resend.emails.cancel called once");
  label(resend.calls[0] === "resend-abc-123", `happy path: cancel called with correct provider_id "resend-abc-123"`);
  label(db.treatmentUpdated.count === 1, "happy path: treatment.aftercare_send_at cleared");
  label(db.treatmentUpdated.value?.aftercare_send_at === null, "happy path: cleared value is null");
  label(db.logRowUpdated.count === 1, "happy path: message_log row marked canceled");
}

// 2. No provider_id → error returned, Resend never called
{
  const { result, resend, logErrors } = await runCancelLogic({ providerId: null });
  label(result.ok === false, "no provider_id: ok is false");
  label(typeof result.error === "string", "no provider_id: error message returned");
  label(resend.calls.length === 0, "no provider_id: resend.cancel NOT called");
  label(logErrors.length > 0, "no provider_id: logError called");
}

// 3. Resend cancel returns generic error → error returned, treatment NOT cleared
{
  const { result, resend, db, logErrors } = await runCancelLogic({
    providerId: "resend-abc-999",
    cancelError: { message: "Network error", statusCode: 500, name: "api_error" },
  });
  label(result.ok === false, "resend error: ok is false");
  label(!result.already_sent, "resend error: already_sent is NOT set");
  label(typeof result.error === "string", "resend error: error message returned");
  label(db.treatmentUpdated.count === 0, "resend error: treatment NOT updated (send may still fire)");
  label(logErrors.length > 0, "resend error: logError called");
}

// 4. Resend cancel returns 422 (already sent) → already_sent: true, logError called
{
  const { result, logErrors } = await runCancelLogic({
    providerId: "resend-sent-already",
    cancelError: { message: "Email already sent", statusCode: 422, name: "validation_error" },
  });
  label(result.ok === false, "already-sent 422: ok is false");
  label(result.already_sent === true, "already-sent 422: already_sent is true");
  label(logErrors.length > 0, "already-sent 422: logError called");
}

// 5. Treatment already sent before we start → early return, Resend never called
{
  const { result, resend } = await runCancelLogic({
    providerId: "resend-xyz",
    aftercare_sent_at: "2026-10-24T14:23:01Z",
  });
  label(result.ok === false && result.already_sent === true, "pre-sent: returns already_sent immediately");
  label(resend.calls.length === 0, "pre-sent: resend.cancel NOT called");
}

console.log(`\n${pass}/${pass + fail} passed (aftercare-cancel)`);
if (fail > 0) process.exit(1);
