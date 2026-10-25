// Tests for treatment-log UI error handling
// Verifies: save failure surfaces an error message (never a silent no-op)

const BOLD = "\x1b[1m", RED = "\x1b[31m", GREEN = "\x1b[32m", RESET = "\x1b[0m";
let pass = 0, fail = 0;
function label(ok, msg) {
  if (ok) pass++; else fail++;
  console.log(`${ok ? `${GREEN}PASS${RESET}` : `${RED}${BOLD}FAIL${RESET}`}  ${msg}`);
}

// Mirrors handleLogTreatment's fetch+error branch logic
async function runLogLogic({ resOk = true, status = 200, responseBody = {} } = {}) {
  let treatmentError = null;
  let treatmentAdded = false;
  let treatmentSaving = true;

  const res = {
    ok: resOk,
    status,
    json: async () => responseBody,
  };

  if (res.ok) {
    const j = await res.json();
    if (j.treatment) treatmentAdded = true;
  } else {
    const j = await res.json().catch(() => ({}));
    if (j.error === "unapproved_procedures" && j.procedures?.length) {
      treatmentError = `Aftercare hasn't been set up for ${j.procedures.join(", ")} yet. Tap the procedure name above to add aftercare instructions first.`;
    } else {
      treatmentError = j.error ?? "Couldn't save the treatment. Try again.";
    }
  }
  treatmentSaving = false;

  return { treatmentError, treatmentAdded, treatmentSaving };
}

console.log("\n── treatment save success ──");
{
  const r = await runLogLogic({ resOk: true, responseBody: { treatment: { id: "t1", aftercare_send_at: "2026-10-25T12:00:00Z" } } });
  label(r.treatmentAdded === true, "success: treatment added to list");
  label(r.treatmentError === null, "success: no error shown");
  label(r.treatmentSaving === false, "success: saving spinner cleared");
}

console.log("\n── treatment save failure (generic 500) ──");
{
  const r = await runLogLogic({ resOk: false, status: 500, responseBody: { error: "Failed to save treatment" } });
  label(r.treatmentAdded === false, "500 error: treatment NOT added to list");
  label(typeof r.treatmentError === "string" && r.treatmentError.length > 0, "500 error: error message shown (never silent)");
  label(r.treatmentSaving === false, "500 error: saving spinner cleared");
}

console.log("\n── treatment save failure (unapproved procedures 422) ──");
{
  const r = await runLogLogic({
    resOk: false, status: 422,
    responseBody: { error: "unapproved_procedures", procedures: ["Lip Filler", "Cheek Filler"] },
  });
  label(r.treatmentAdded === false, "422 unapproved: treatment NOT added");
  label(r.treatmentError?.includes("Lip Filler") && r.treatmentError?.includes("Cheek Filler"), "422 unapproved: procedure names shown in error");
  label(r.treatmentError?.includes("aftercare"), "422 unapproved: actionable message mentions aftercare");
}

console.log("\n── treatment save failure (JSON parse error) ──");
{
  let treatmentError = null;
  const res = {
    ok: false,
    status: 503,
    json: async () => { throw new Error("not json"); },
  };
  const j = await res.json().catch(() => ({}));
  treatmentError = j.error ?? "Couldn't save the treatment. Try again.";
  label(typeof treatmentError === "string" && treatmentError.length > 0, "JSON error: fallback message shown");
}

console.log(`\n${pass}/${pass + fail} passed (treatment-log)`);
if (fail > 0) process.exit(1);
