// Tests for the DB-queue aftercare design
// Covers: cancel (DB-only), cron idempotency, CancelAftercarePopup logic
// Run from project root: node scripts/test-aftercare-cancel.mjs

const BOLD = "\x1b[1m", RED = "\x1b[31m", GREEN = "\x1b[32m", RESET = "\x1b[0m";
let pass = 0, fail = 0;
function label(ok, msg) {
  if (ok) pass++; else fail++;
  const tag = ok ? `${GREEN}PASS${RESET}` : `${RED}${BOLD}FAIL${RESET}`;
  console.log(`${tag}  ${msg}`);
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

function makeDb({ aftercare_sent_at = null, updateFails = false } = {}) {
  const treatmentUpdated = { count: 0, value: null };
  return {
    treatmentUpdated,
    from(table) {
      return {
        select() { return this; },
        eq() { return this; },
        single() {
          if (table === "treatments") {
            return Promise.resolve({
              data: { id: "t1", nurse_id: "n1", aftercare_send_at: "2026-10-25T14:00:00Z", aftercare_sent_at },
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
              return resolve({ error: null });
            },
          };
        },
      };
    },
  };
}

// Mirrors the new cancel route logic (DB-only, no Resend)
async function runCancelLogic({ aftercare_sent_at = null, updateFails = false } = {}) {
  const db = makeDb({ aftercare_sent_at, updateFails });
  const logErrors = [];
  async function logError(area, msg) { logErrors.push({ area, msg }); }

  const { data: treatment } = await db.from("treatments").select().eq().single();

  if (treatment.aftercare_sent_at) {
    return { result: { ok: false, already_sent: true }, db, logErrors };
  }

  const { error: updateErr } = await db.from("treatments").update({ aftercare_send_at: null, aftercare_claimed_at: null }).eq().eq().then(r => r);
  if (updateErr) {
    await logError("aftercare-cancel", updateErr.message);
    return { result: { ok: false, error: "Failed to cancel" }, db, logErrors };
  }

  return { result: { ok: true }, db, logErrors };
}

// ── Cancel tests ──────────────────────────────────────────────────────────────

console.log("\n── cancel: success ──");
{
  const { result, db } = await runCancelLogic();
  label(result.ok === true, "cancel: ok is true");
  label(db.treatmentUpdated.value?.aftercare_send_at === null, "cancel: aftercare_send_at cleared");
  label(db.treatmentUpdated.value?.aftercare_claimed_at === null, "cancel: aftercare_claimed_at cleared");
  label(db.treatmentUpdated.count === 1, "cancel: exactly one DB update");
}

console.log("\n── cancel: already sent ──");
{
  const { result, db } = await runCancelLogic({ aftercare_sent_at: "2026-10-25T14:00:01Z" });
  label(result.ok === false && result.already_sent === true, "already-sent: returns already_sent immediately");
  label(db.treatmentUpdated.count === 0, "already-sent: no DB update attempted");
}

console.log("\n── cancel: DB error ──");
{
  const { result, logErrors } = await runCancelLogic({ updateFails: true });
  label(result.ok === false, "db-error: ok is false");
  label(typeof result.error === "string", "db-error: error message returned");
  label(logErrors.length > 0, "db-error: logError called");
}

// ── Cron idempotency tests ─────────────────────────────────────────────────────

// Mirrors the cron's atomic claim + send logic
function makeCronDb({ aftercare_sent_at = null, claimFails = false, sendFails = false } = {}) {
  const updates = [];
  const logErrors = [];
  return {
    updates,
    logErrors,
    from(table) {
      return {
        select() { return this; },
        eq() { return this; },
        or() { return this; },
        lte() { return this; },
        is() { return this; },
        limit() { return this; },
        async then(resolve) { return resolve({ data: [], error: null }); },
        update(fields) {
          const chain = {
            eq() { return this; },
            or() { return this; },
            is() { return this; },
            select() { return this; },
            async maybeSingle() {
              updates.push(fields);
              if (claimFails) return { data: null, error: null };
              return { data: { id: "t1" }, error: null };
            },
            async then(resolve) {
              updates.push(fields);
              return resolve({ error: null });
            },
          };
          return chain;
        },
      };
    },
  };
}

async function runCronSend({ aftercare_sent_at = null, claimFails = false } = {}) {
  const db = makeCronDb({ aftercare_sent_at, claimFails });
  const sends = [];
  const logErrors = [];
  async function logError(area, msg) { logErrors.push({ area, msg }); }

  const treatment = { id: "t1", nurse_id: "n1", intake_id: "i1", procedure_id: "p1", procedure_name: "Lip Filler" };
  const staleClaimBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  // Step 1: atomic claim
  const { data: claimed } = await db.from("treatments")
    .update({ aftercare_claimed_at: new Date().toISOString() })
    .eq().or().is().select().maybeSingle();

  if (!claimed) {
    return { claimed: false, sends, logErrors, db };
  }

  // Step 2: send (mocked)
  sends.push({ to: "client@example.com", treatment_id: treatment.id });

  // Step 3: mark sent
  await db.from("treatments")
    .update({ aftercare_sent: true, aftercare_sent_at: new Date().toISOString(), aftercare_send_at: null, aftercare_claimed_at: null })
    .eq().then(r => r);

  return { claimed: true, sends, logErrors, db };
}

console.log("\n── cron: schedule → send once ──");
{
  const r = await runCronSend();
  label(r.claimed === true, "cron: row claimed successfully");
  label(r.sends.length === 1, "cron: email sent exactly once");
  const markSent = r.db.updates.find(u => u.aftercare_sent === true);
  label(!!markSent, "cron: aftercare_sent = true written");
  label(markSent?.aftercare_send_at === null, "cron: aftercare_send_at cleared on success");
  label(markSent?.aftercare_claimed_at === null, "cron: aftercare_claimed_at cleared on success");
}

console.log("\n── cron: second worker loses the claim ──");
{
  const r = await runCronSend({ claimFails: true });
  label(r.claimed === false, "second-worker: claim returns null → skipped");
  label(r.sends.length === 0, "second-worker: email NOT sent");
}

console.log("\n── cron: cancel before send → nothing sent ──");
{
  // Simulate: nurse cancels (aftercare_send_at = null) before cron runs.
  // The cron's initial SELECT filtered on aftercare_send_at IS NOT NULL, so
  // a canceled treatment would never appear in `due`. This test verifies the
  // filtering logic conceptually.
  const due = [
    { id: "t1", aftercare_send_at: "2026-10-25T14:00:00Z", aftercare_sent_at: null },
    { id: "t2", aftercare_send_at: null,                   aftercare_sent_at: null }, // canceled
  ].filter(t => t.aftercare_send_at !== null && t.aftercare_sent_at === null);
  label(due.length === 1, "cancel-before-cron: canceled row excluded from due list");
  label(due[0].id === "t1", "cancel-before-cron: only uncanceled row remains");
}

// ── CancelAftercarePopup UI logic ─────────────────────────────────────────────

// Cancel API now always returns ok:true (DB-only, no Resend). The popup still
// guards against navigation before confirmation.
async function runPopupLogic({ cancelOk = true, alreadySent = false } = {}) {
  let onCanceledCalled = false;
  let onChangeItCalled = false;
  let shownError = null;

  async function doCancel() {
    if (cancelOk) return true;
    shownError = alreadySent ? "Already sent — it's on its way!" : "Couldn't cancel. Try again.";
    return false;
  }

  async function handleDontSend() { const ok = await doCancel(); if (ok) onCanceledCalled = true; }
  async function handleChangeIt() { const ok = await doCancel(); if (ok) onChangeItCalled = true; }

  return { handleDontSend, handleChangeIt, result: () => ({ onCanceledCalled, onChangeItCalled, shownError }) };
}

console.log("\n── CancelAftercarePopup UI logic ──");
{
  const sim = await runPopupLogic({ cancelOk: true });
  await sim.handleDontSend();
  const r = sim.result();
  label(r.onCanceledCalled === true, "popup: cancel success + Don't send → onCanceled called");
  label(r.onChangeItCalled === false, "popup: cancel success + Don't send → onChangeIt NOT called");
}
{
  const sim = await runPopupLogic({ cancelOk: false });
  await sim.handleChangeIt();
  const r = sim.result();
  label(r.onChangeItCalled === false, "popup: cancel failure → onChangeIt NOT called (two-email guard still applies)");
  label(typeof r.shownError === "string" && r.shownError.length > 0, "popup: cancel failure → error message shown");
}
{
  const sim = await runPopupLogic({ cancelOk: true });
  await sim.handleChangeIt();
  const r = sim.result();
  label(r.onChangeItCalled === true, "popup: cancel success + Change it → onChangeIt called");
  label(r.onCanceledCalled === false, "popup: cancel success + Change it → onCanceled NOT called");
}

console.log(`\n${pass}/${pass + fail} passed (aftercare-cancel)`);
if (fail > 0) process.exit(1);
