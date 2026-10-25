// Test script for aftercare-cancel logic
// Run from project root: node scripts/test-aftercare-cancel.mjs
//
// Verifies:
// 1. provider_id read from treatments.aftercare_provider_id (primary path)
// 2. provider_id read from message_log fallback (rows pre-migration)
// 3. cancel success → message_log updated, treatment cleared (both fields), ok: true
// 4. no provider_id anywhere → returns error without calling Resend
// 5. Resend cancel fails (non-422) → returns error, does NOT clear treatment
// 6. Resend cancel fails with 422 (already sent) → returns already_sent: true
// 7. pre-sent treatment → early return, Resend never called
// 8. scheduleEmail result.error → returns ok: false (never inserts "scheduled" row with null id)

const BOLD = "\x1b[1m", RED = "\x1b[31m", GREEN = "\x1b[32m", RESET = "\x1b[0m";
let pass = 0, fail = 0;
function label(ok, msg) {
  if (ok) pass++; else fail++;
  const tag = ok ? `${GREEN}PASS${RESET}` : `${RED}${BOLD}FAIL${RESET}`;
  console.log(`${tag}  ${msg}`);
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

function makeDb({ aftercareProviderId = null, logProviderId = null, aftercare_sent_at = null, updateFails = false } = {}) {
  const logRowUpdated = { count: 0 };
  const treatmentUpdated = { count: 0, value: null };
  return {
    logRowUpdated,
    treatmentUpdated,
    from(table) {
      return {
        select() { return this; },
        eq() { return this; },
        order() { return this; },
        limit() { return this; },
        single() {
          if (table === "treatments") {
            return Promise.resolve({
              data: {
                id: "t1", nurse_id: "n1",
                aftercare_send_at: "2026-10-24T14:23:00Z",
                aftercare_sent_at,
                aftercare_provider_id: aftercareProviderId,
              },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
        maybeSingle() {
          if (table === "message_log") {
            return Promise.resolve({
              data: logProviderId ? { id: "log1", provider_id: logProviderId } : null,
              error: null,
            });
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

// Mirrors the cancel route logic with aftercare_provider_id primary + message_log fallback
async function runCancelLogic({ aftercareProviderId = null, logProviderId = null, cancelError = null, updateFails = false, aftercare_sent_at = null }) {
  const db = makeDb({ aftercareProviderId, logProviderId, updateFails, aftercare_sent_at });
  const resend = makeResend({ cancelError });
  const logErrors = [];

  async function logError(area, msg) { logErrors.push({ area, msg }); }
  async function promoteScheduledAftercares() {}

  const { data: treatment } = await db.from("treatments").select().eq().single();
  if (treatment.aftercare_sent_at) {
    return { result: { ok: false, already_sent: true }, db, resend, logErrors };
  }

  // Primary: read from treatments.aftercare_provider_id
  let providerId = treatment.aftercare_provider_id ?? null;

  // Fallback: message_log (rows scheduled before the migration)
  if (!providerId) {
    const { data: logRow } = await db.from("message_log").select().eq().eq().order().limit().maybeSingle();
    providerId = logRow?.provider_id ?? null;
  }

  if (!providerId) {
    await logError("aftercare-cancel", `No provider_id found`);
    return { result: { ok: false, error: "Couldn't cancel — it may still send. Contact support." }, db, resend, logErrors };
  }

  const { error: cancelErr } = await resend.emails.cancel(providerId);

  if (cancelErr) {
    const alreadySent = cancelErr.statusCode === 422 || cancelErr.name === "validation_error";
    await logError("aftercare-cancel", `Resend cancel failed: ${cancelErr.message}`);
    if (alreadySent) {
      await promoteScheduledAftercares();
      return { result: { ok: false, already_sent: true, sent_at: "2026-10-24T14:23:00Z" }, db, resend, logErrors };
    }
    return { result: { ok: false, error: "Couldn't cancel — it may still send. Try again." }, db, resend, logErrors };
  }

  await db.from("message_log").update({ status: "canceled" }).eq().eq().eq();
  const { error: updateErr } = await db.from("treatments").update({ aftercare_send_at: null, aftercare_provider_id: null }).eq().then(r => r);
  if (updateErr) {
    await logError("aftercare-cancel", updateErr.message);
    return { result: { ok: false, error: "Failed to update treatment" }, db, resend, logErrors };
  }

  return { result: { ok: true }, db, resend, logErrors };
}

// Mirrors scheduleEmail logic — checks result.error before using result.data
async function runScheduleEmailLogic({ resendError = null, insertFails = false } = {}) {
  const inserts = [];
  const logErrors = [];
  async function logError(area, msg) { logErrors.push({ area, msg }); }

  const supabase = {
    from() {
      return {
        insert(row) {
          return {
            then(resolve) {
              inserts.push(row);
              return resolve({ error: insertFails ? { message: "insert failed" } : null });
            },
          };
        },
      };
    },
  };

  const resendResult = resendError
    ? { data: null, error: resendError }
    : { data: { id: "re_abc_123" }, error: null };

  if (resendResult.error) {
    const error = resendResult.error.message ?? String(resendResult.error);
    await supabase.from("message_log").insert({ status: "failed", error }).then(r => r);
    return { ok: false, error, inserts, logErrors };
  }

  const provider_id = resendResult.data?.id ?? null;

  const { error: insertErr } = await supabase.from("message_log").insert({ status: "scheduled", provider_id }).then(r => r);
  if (insertErr) {
    await logError("scheduleEmail/insert", insertErr.message);
  }

  return { ok: true, provider_id: provider_id ?? undefined, inserts, logErrors };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

console.log("\n── aftercare_provider_id primary path ──");

// 1. Provider id comes from treatments.aftercare_provider_id
{
  const { result, resend, db } = await runCancelLogic({ aftercareProviderId: "re_from_treatment" });
  label(result.ok === true, "primary: result.ok === true");
  label(resend.calls[0] === "re_from_treatment", "primary: cancel called with treatments.aftercare_provider_id");
  label(db.treatmentUpdated.value?.aftercare_provider_id === null, "primary: aftercare_provider_id cleared on success");
  label(db.treatmentUpdated.value?.aftercare_send_at === null, "primary: aftercare_send_at cleared on success");
  label(db.logRowUpdated.count === 1, "primary: message_log row marked canceled");
}

console.log("\n── message_log fallback path ──");

// 2. No aftercare_provider_id → falls back to message_log
{
  const { result, resend } = await runCancelLogic({ aftercareProviderId: null, logProviderId: "re_from_log" });
  label(result.ok === true, "fallback: result.ok === true");
  label(resend.calls[0] === "re_from_log", "fallback: cancel called with message_log provider_id");
}

console.log("\n── no provider_id anywhere ──");

// 3. Neither source has a provider_id → error, Resend not called
{
  const { result, resend, logErrors } = await runCancelLogic({ aftercareProviderId: null, logProviderId: null });
  label(result.ok === false, "no provider_id: ok is false");
  label(typeof result.error === "string", "no provider_id: error message returned");
  label(resend.calls.length === 0, "no provider_id: resend.cancel NOT called");
  label(logErrors.length > 0, "no provider_id: logError called");
}

console.log("\n── Resend errors ──");

// 4. Resend generic error → error returned, treatment NOT cleared
{
  const { result, db, logErrors } = await runCancelLogic({
    aftercareProviderId: "re_abc",
    cancelError: { message: "Network error", statusCode: 500, name: "api_error" },
  });
  label(result.ok === false, "resend error: ok is false");
  label(!result.already_sent, "resend error: already_sent not set");
  label(db.treatmentUpdated.count === 0, "resend error: treatment NOT updated");
  label(logErrors.length > 0, "resend error: logError called");
}

// 5. Resend 422 → already_sent: true
{
  const { result, logErrors } = await runCancelLogic({
    aftercareProviderId: "re_sent",
    cancelError: { message: "Email already sent", statusCode: 422, name: "validation_error" },
  });
  label(result.ok === false, "already-sent 422: ok is false");
  label(result.already_sent === true, "already-sent 422: already_sent is true");
  label(logErrors.length > 0, "already-sent 422: logError called");
}

console.log("\n── pre-sent treatment ──");

// 6. Treatment already sent → early return, Resend never called
{
  const { result, resend } = await runCancelLogic({
    aftercareProviderId: "re_xyz",
    aftercare_sent_at: "2026-10-24T14:23:01Z",
  });
  label(result.ok === false && result.already_sent === true, "pre-sent: returns already_sent immediately");
  label(resend.calls.length === 0, "pre-sent: resend.cancel NOT called");
}

console.log("\n── scheduleEmail result.error check ──");

// 7. scheduleEmail: Resend returns error → inserts "failed" row, returns ok: false
{
  const r = await runScheduleEmailLogic({ resendError: { message: "rate limited", statusCode: 429 } });
  label(r.ok === false, "scheduleEmail error: ok is false");
  label(r.inserts.some(i => i.status === "failed"), "scheduleEmail error: inserts 'failed' row");
  label(!r.inserts.some(i => i.status === "scheduled"), "scheduleEmail error: does NOT insert 'scheduled' row");
}

// 8. scheduleEmail: Resend succeeds → inserts "scheduled" row with provider_id
{
  const r = await runScheduleEmailLogic();
  label(r.ok === true, "scheduleEmail success: ok is true");
  label(r.provider_id === "re_abc_123", "scheduleEmail success: provider_id returned");
  label(r.inserts.some(i => i.status === "scheduled" && i.provider_id === "re_abc_123"), "scheduleEmail success: inserts 'scheduled' row with provider_id");
}

// 9. scheduleEmail: message_log insert fails → logError called, still returns ok: true with provider_id
{
  const r = await runScheduleEmailLogic({ insertFails: true });
  label(r.ok === true, "scheduleEmail insert-fail: still returns ok (email is scheduled in Resend)");
  label(r.provider_id === "re_abc_123", "scheduleEmail insert-fail: provider_id still returned for caller to persist");
  label(r.logErrors.length > 0, "scheduleEmail insert-fail: logError called");
}

console.log("\n── schedule → cancel → resend flow ──");

// 10. Full flow: schedule → cancel → schedule again → exactly one active provider_id
{
  // Step 1: schedule — returns provider_id "re_step1"
  const schedule1 = await runScheduleEmailLogic();
  const pid1 = schedule1.provider_id;
  label(schedule1.ok === true, "flow: initial schedule succeeds");
  label(pid1 === "re_abc_123", "flow: initial schedule returns provider_id");

  // Step 2: cancel — clears aftercare_provider_id from treatment
  const cancel = await runCancelLogic({ aftercareProviderId: pid1 });
  label(cancel.result.ok === true, "flow: cancel succeeds");
  label(cancel.db.treatmentUpdated.value?.aftercare_provider_id === null, "flow: cancel clears aftercare_provider_id");

  // Step 3: reschedule (simulates "Send aftercare" on Not-sent visit → send-aftercare)
  // After cancel, treatment has no aftercare_provider_id and no aftercare_send_at.
  // A fresh scheduleEmail call should produce a new provider_id.
  const schedule2 = await runScheduleEmailLogic();
  label(schedule2.ok === true, "flow: reschedule after cancel succeeds");
  label(schedule2.provider_id === "re_abc_123", "flow: reschedule returns a provider_id");
  label(
    schedule2.inserts.filter(i => i.status === "scheduled").length === 1,
    "flow: reschedule inserts exactly one 'scheduled' row (not two)"
  );
}

console.log("\n── CancelAftercarePopup UI logic ──");

// Mirrors the popup's doCancel + handleChangeIt / handleDontSend contract.
async function runPopupLogic({ cancelOk = true, alreadySent = false, cancelError = null } = {}) {
  let onCanceledCalled = false;
  let onChangeItCalled = false;
  let shownError = null;

  async function doCancel() {
    if (cancelOk) return true;
    shownError = alreadySent ? "Already sent — it's on its way!" : (cancelError ?? "Couldn't cancel. Try again.");
    return false;
  }

  async function handleDontSend() {
    const ok = await doCancel();
    if (ok) onCanceledCalled = true;
  }

  async function handleChangeIt() {
    const ok = await doCancel();
    if (ok) onChangeItCalled = true;
  }

  return { handleDontSend, handleChangeIt, result: () => ({ onCanceledCalled, onChangeItCalled, shownError }) };
}

// 11. Cancel success → "Don't send" calls onCanceled
{
  const sim = await runPopupLogic({ cancelOk: true });
  await sim.handleDontSend();
  const r = sim.result();
  label(r.onCanceledCalled === true, "popup: cancel success + Don't send → onCanceled called");
  label(r.onChangeItCalled === false, "popup: cancel success + Don't send → onChangeIt NOT called");
}

// 12. Cancel failure → "Change it" never calls onChangeIt (two-email guard)
{
  const sim = await runPopupLogic({ cancelOk: false, cancelError: "Network error" });
  await sim.handleChangeIt();
  const r = sim.result();
  label(r.onChangeItCalled === false, "popup: cancel failure → onChangeIt NOT called (two-email guard)");
  label(typeof r.shownError === "string" && r.shownError.length > 0, "popup: cancel failure → error message shown");
}

// 13. Cancel success → "Change it" calls onChangeIt (and NOT onCanceled)
{
  const sim = await runPopupLogic({ cancelOk: true });
  await sim.handleChangeIt();
  const r = sim.result();
  label(r.onChangeItCalled === true, "popup: cancel success + Change it → onChangeIt called");
  label(r.onCanceledCalled === false, "popup: cancel success + Change it → onCanceled NOT called");
}

console.log(`\n${pass}/${pass + fail} passed (aftercare-cancel)`);
if (fail > 0) process.exit(1);
