/**
 * Tests that:
 * (a) /api/procedures POST rejects approved:true with empty aftercare_instructions (server-side 400)
 * (b) Onboarding step 4 always includes aftercare_instructions when approving
 * (c) The textarea sync fix: editedAftercare is populated directly from onChange on each keystroke
 *
 * Run: node scripts/test-procedures-approve-validation.mjs
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}

console.log("\nProcedures approve validation tests\n");

// ── (a) Route validation logic ────────────────────────────────────────────────

function routeApproveValidation(approved, body) {
  // Replicate the guard added to /api/procedures POST
  if (approved && "aftercare_instructions" in body) {
    const instr = typeof body.aftercare_instructions === "string"
      ? body.aftercare_instructions.trim()
      : "";
    if (!instr) {
      return { status: 400, error: "Write your aftercare instructions before approving." };
    }
  }
  return { status: 200 };
}

test("approved:true + aftercare_instructions:'' → 400", () => {
  const r = routeApproveValidation(true, { aftercare_instructions: "" });
  assert.equal(r.status, 400);
  assert.ok(r.error.includes("aftercare"));
});

test("approved:true + aftercare_instructions:'   ' (whitespace) → 400", () => {
  const r = routeApproveValidation(true, { aftercare_instructions: "   " });
  assert.equal(r.status, 400);
});

test("approved:true + aftercare_instructions:'some text' → 200", () => {
  assert.equal(routeApproveValidation(true, { aftercare_instructions: "some text" }).status, 200);
});

test("approved:true + no aftercare_instructions key → 200 (DB may already have text)", () => {
  assert.equal(routeApproveValidation(true, {}).status, 200);
});

test("approved:false + aftercare_instructions:'' → 200 (unapproving doesn't need text)", () => {
  assert.equal(routeApproveValidation(false, { aftercare_instructions: "" }).status, 200);
});

// ── (b) Route source has the new guard ────────────────────────────────────────

const routeSrc = readFileSync(join(ROOT, "app/api/procedures/route.ts"), "utf8");

test("route POST checks 'aftercare_instructions' in rest when approved", () => {
  assert.ok(
    routeSrc.includes('"aftercare_instructions" in rest'),
    "route must check if aftercare_instructions is explicitly present before validating"
  );
});

test("route POST returns 400 for empty aftercare on approval", () => {
  assert.ok(
    routeSrc.includes("Write your aftercare instructions before approving"),
    "route must reject empty aftercare with a 400"
  );
});

// ── (c) Onboarding sends aftercare in real-time, not via editBuf ──────────────

const onboardingSrc = readFileSync(join(ROOT, "app/onboarding/page.tsx"), "utf8");

test("StepAftercareReview textarea uses draft.editedAftercare directly (no editBuf)", () => {
  assert.ok(
    onboardingSrc.includes("onChange({ editedAftercare: { ...draft.editedAftercare, [name]: e.target.value } })"),
    "textarea onChange must write directly to draft.editedAftercare so goNext always sees latest text"
  );
});

test("StepAftercareReview does NOT use setEditBuf (removed local buffer)", () => {
  assert.ok(
    !onboardingSrc.includes("setEditBuf("),
    "editBuf local state was removed — text is now controlled by draft.editedAftercare"
  );
});

test("goNext step 4 includes aftercareText fallback to defaults", () => {
  assert.ok(
    onboardingSrc.includes("defaults?.aftercare_instructions") &&
    onboardingSrc.includes("aftercareText"),
    "goNext step 4 must fall back to defaults when user hasn't edited the text"
  );
});

test("goNext step 4 sends empty string to trigger server 400 when approving with no text", () => {
  assert.ok(
    onboardingSrc.includes('body.aftercare_instructions = ""') &&
    onboardingSrc.includes("isApproved"),
    "goNext must send empty string when approving a procedure with no aftercare anywhere"
  );
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
