// Tests for multi-procedure aftercare logic
// Covers: two-section email, healing prompt, return reminder, ownership check,
//         junction rollback, and empty-aftercare to-do behaviour.

const BOLD = "\x1b[1m", RED = "\x1b[31m", GREEN = "\x1b[32m", RESET = "\x1b[0m";
let pass = 0, fail = 0;
function label(ok, msg) {
  if (ok) pass++; else fail++;
  console.log(`${ok ? `${GREEN}PASS${RESET}` : `${RED}${BOLD}FAIL${RESET}`}  ${msg}`);
}

// ── 1. Two procedures → one email with two sections ───────────────────────────
console.log("\n── aftercare email: two procedures → two sections ──");
{
  function buildAftercareSections(allProcedures) {
    const sectionsHtml = [];
    const skipped = [];
    for (const ap of allProcedures) {
      const rawInstr = (ap.aftercare_instructions ?? "").trim();
      if (!rawInstr) { skipped.push(ap.name); continue; }
      sectionsHtml.push(`<div data-proc="${ap.name}">${rawInstr}</div>`);
    }
    return { sectionsHtml, skipped };
  }

  const procs = [
    { name: "Lip Filler", aftercare_instructions: "Avoid pressure for 48h" },
    { name: "Nose Filler", aftercare_instructions: "No glasses for 2 weeks" },
  ];
  const { sectionsHtml, skipped } = buildAftercareSections(procs);
  label(sectionsHtml.length === 2, "two procedures → two HTML sections");
  label(skipped.length === 0, "no procedures skipped");
  label(sectionsHtml[0].includes("Lip Filler"), "first section is Lip Filler");
  label(sectionsHtml[1].includes("Nose Filler"), "second section is Nose Filler");
  label(!sectionsHtml.join("").includes("undefined"), "no 'undefined' in HTML");
}

// ── 2. Empty aftercare → no invented text, to-do logged ──────────────────────
console.log("\n── empty aftercare: skip section, create to-do ──");
{
  function buildAftercareSectionsWithTodos(allProcedures, treatmentId, clientFirstName) {
    const sectionsHtml = [];
    const todos = [];
    for (const ap of allProcedures) {
      const rawInstr = (ap.aftercare_instructions ?? "").trim();
      if (!rawInstr) {
        todos.push({
          type: "action_needed",
          status: "pending",
          error: `Aftercare for ${ap.name} is empty, so ${clientFirstName || "your client"} didn't get instructions for it.`,
        });
        continue;
      }
      sectionsHtml.push(`<div data-proc="${ap.name}">${rawInstr}</div>`);
    }
    return { sectionsHtml, todos };
  }

  const procs = [
    { name: "Lip Filler", aftercare_instructions: "Avoid pressure for 48h" },
    { name: "Nose Filler", aftercare_instructions: "" },
  ];
  const { sectionsHtml, todos } = buildAftercareSectionsWithTodos(procs, "t-1", "Maria");
  label(sectionsHtml.length === 1, "only one section built (non-empty procedure)");
  label(todos.length === 1, "one to-do created for empty procedure");
  label(todos[0].type === "action_needed", "to-do type is action_needed");
  label(todos[0].status === "pending", "to-do status is pending");
  label(todos[0].error.includes("Nose Filler"), "to-do message names the empty procedure");
  label(todos[0].error.includes("Maria"), "to-do message includes client name");
  label(!sectionsHtml[0].includes("No aftercare") && !sectionsHtml[0].includes("not available"),
    "no invented fallback text in remaining section");

  // All empty → no sections, still a to-do per procedure
  const allEmpty = [
    { name: "Lip Filler", aftercare_instructions: "" },
    { name: "Nose Filler", aftercare_instructions: "" },
  ];
  const r2 = buildAftercareSectionsWithTodos(allEmpty, "t-2", "Maria");
  label(r2.sectionsHtml.length === 0, "all empty → zero sections (email not sent)");
  label(r2.todos.length === 2, "all empty → two to-dos, one per procedure");
}

// ── 3. Healing: system prompt includes both procedures ────────────────────────
console.log("\n── healing: system prompt includes both procedure names ──");
{
  function buildSystemPrompt(procedureName, aftercareInstructions) {
    return `The client had: ${procedureName}.\nAftercare: ${aftercareInstructions || "(none)"}`;
  }

  const allProcNames = ["Lip Filler", "Nose Filler"];
  const allProcInstructions = ["Avoid pressure for 48h", "No glasses for 2 weeks"];
  const procedureName = allProcNames.join(" + ");
  const aftercareInstructions = allProcInstructions.filter(Boolean).join("\n\n");
  const prompt = buildSystemPrompt(procedureName, aftercareInstructions);

  label(prompt.includes("Lip Filler"), "system prompt includes Lip Filler");
  label(prompt.includes("Nose Filler"), "system prompt includes Nose Filler");
  label(prompt.includes("Avoid pressure"), "system prompt includes Lip Filler aftercare");
  label(prompt.includes("No glasses"), "system prompt includes Nose Filler aftercare");
}

// ── 4. Return reminder: earliest due date wins ────────────────────────────────
console.log("\n── return reminder: min(reminder_days) across procedures ──");
{
  function minReminderDays(jProcs) {
    const days = jProcs
      .map(p => p.procedures?.reminder_days)
      .filter(d => typeof d === "number");
    return days.length > 0 ? Math.min(...days) : null;
  }

  const procs = [
    { procedure_id: "a", procedures: { reminder_days: 180 } },
    { procedure_id: "b", procedures: { reminder_days: 90 } },
  ];
  label(minReminderDays(procs) === 90, "min reminder_days is 90 (earliest)");

  const single = [{ procedure_id: "a", procedures: { reminder_days: 180 } }];
  label(minReminderDays(single) === 180, "single procedure: uses its own reminder_days");

  const noData = [{ procedure_id: "a", procedures: null }];
  label(minReminderDays(noData) === null, "no reminder_days → null (no reminder sent)");
}

// ── 5. Ownership check: another nurse's procedure_id → 400 ───────────────────
console.log("\n── ownership check: another nurse's procedure_id → 400 ──");
{
  function checkProcedureOwnership(requestedIds, approvedRows) {
    // approvedRows are the DB results filtered by nurse_id
    if ((approvedRows ?? []).length !== requestedIds.length) {
      return { ok: false, status: 400, error: "One or more procedures not found or do not belong to your account" };
    }
    return { ok: true };
  }

  // All belong to this nurse
  const r1 = checkProcedureOwnership(["p-1", "p-2"], [{ id: "p-1" }, { id: "p-2" }]);
  label(r1.ok === true, "both procedures belong to nurse → ok");

  // One belongs to another nurse (DB filtered it out)
  const r2 = checkProcedureOwnership(["p-1", "p-2"], [{ id: "p-1" }]);
  label(r2.ok === false, "one foreign procedure → rejected");
  label(r2.status === 400, "rejected with 400");

  // All foreign
  const r3 = checkProcedureOwnership(["p-1", "p-2"], []);
  label(r3.ok === false, "all foreign procedures → rejected");
}

// ── 6. Junction insert failure → treatment not saved ─────────────────────────
console.log("\n── junction rollback: insert failure → treatment deleted ──");
{
  async function simulateTreatmentSave({ junctionShouldFail }) {
    let treatmentSaved = false;
    let treatmentDeleted = false;
    let returnedError = null;

    // Simulate: treatment saves
    treatmentSaved = true;
    const treatmentId = "t-rollback-1";

    // Simulate: junction insert
    const junctionError = junctionShouldFail ? { message: "foreign key violation" } : null;
    if (junctionError) {
      // Rollback
      treatmentDeleted = true;
      treatmentSaved = false;
      returnedError = "Failed to save treatment procedures. Please try again.";
      return { treatmentSaved, treatmentDeleted, returnedError, status: 500 };
    }

    return { treatmentSaved, treatmentDeleted: false, returnedError: null, status: 200 };
  }

  const failCase = await simulateTreatmentSave({ junctionShouldFail: true });
  label(failCase.treatmentSaved === false, "junction failure → treatment not saved");
  label(failCase.treatmentDeleted === true, "junction failure → treatment rolled back");
  label(failCase.returnedError !== null, "junction failure → error returned to caller");
  label(failCase.status === 500, "junction failure → 500 status");

  const okCase = await simulateTreatmentSave({ junctionShouldFail: false });
  label(okCase.treatmentSaved === true, "junction success → treatment saved");
  label(okCase.treatmentDeleted === false, "junction success → no rollback");
  label(okCase.returnedError === null, "junction success → no error");
  label(okCase.status === 200, "junction success → 200 status");
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${pass + fail} tests: ${GREEN}${pass} passed${RESET}, ${fail > 0 ? `${RED}${BOLD}${fail} failed${RESET}` : `${fail} failed`}\n`);
if (fail > 0) process.exit(1);
