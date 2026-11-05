/**
 * Tests that:
 * (a) /api/procedures POST rejects saves with no name and no id (would become a DB INSERT without name)
 * (b) Onboarding step 4 includes name in the POST body so the route can fall back to upsert by name
 *
 * Run: node scripts/test-procedures-name-validation.mjs
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

console.log("\nProcedures name validation tests\n");

// ── (a) Route validation logic ────────────────────────────────────────────────
// Replicate the guard added to /api/procedures POST.

function routeValidation(body) {
  const hasId = typeof body.id === "string" && body.id.trim().length > 0;
  if (!hasId) {
    const bodyName = typeof body.name === "string" ? body.name.trim() : "";
    if (!bodyName) {
      return { status: 400, error: "Procedure name is required." };
    }
  }
  return { status: 200 };
}

test("no name + no id → 400", () => {
  const r = routeValidation({});
  assert.equal(r.status, 400);
  assert.ok(r.error.includes("name"));
});

test("empty name + no id → 400", () => {
  assert.equal(routeValidation({ name: "" }).status, 400);
});

test("whitespace-only name + no id → 400", () => {
  assert.equal(routeValidation({ name: "   " }).status, 400);
});

test("no name + valid id → 200 (update path, name already in DB)", () => {
  assert.equal(routeValidation({ id: "some-uuid-1234-5678" }).status, 200);
});

test("empty-string id treated as no id → 400 when also no name", () => {
  // JSON.stringify drops undefined; an empty-string id must not silently trigger INSERT
  assert.equal(routeValidation({ id: "" }).status, 400);
});

test("empty-string id but valid name → 200 (falls back to upsert by name)", () => {
  assert.equal(routeValidation({ id: "", name: "Tear Trough" }).status, 200);
});

test("valid name + no id → 200 (new procedure creation)", () => {
  assert.equal(routeValidation({ name: "Microneedling" }).status, 200);
});

test("both name and id present → 200", () => {
  assert.equal(routeValidation({ id: "uuid-123", name: "Lip Filler" }).status, 200);
});

// ── (b) Onboarding step 4 sends name in every POST body ───────────────────────

const onboardingSrc = readFileSync(join(ROOT, "app/onboarding/page.tsx"), "utf8");

test("onboarding step 4 goNext includes body.name from p.name", () => {
  // Check that the step 4 POST body sets name from p.name
  assert.ok(
    onboardingSrc.includes("body.name = p.name"),
    "step 4 must set body.name = p.name so the route can upsert by name if id is falsy"
  );
});

test("onboarding step 4 body.name is conditional on p.name being present", () => {
  // Should be guarded: if (p.name) body.name = p.name
  assert.ok(
    onboardingSrc.includes("if (p.name) body.name = p.name"),
    "body.name must only be set when p.name is truthy"
  );
});

test("onboarding step 2 always sends name in body (loop variable guard)", () => {
  // step 2 uses: for (const name of services) { body: JSON.stringify({ name, ... }) }
  // services has filter(Boolean) so name is always a non-empty string
  assert.ok(
    onboardingSrc.includes("filter(Boolean)") &&
    onboardingSrc.includes("body: JSON.stringify({\n              name,"),
    "step 2 must send name and use filter(Boolean) on the services list"
  );
});

// ── (c) Route source contains the validation guard ───────────────────────────

const routeSrc = readFileSync(join(ROOT, "app/api/procedures/route.ts"), "utf8");

test("route POST validates name before reaching DB", () => {
  assert.ok(
    routeSrc.includes("Procedure name is required"),
    "route must have a 400 guard for missing name"
  );
});

test("route uses hasId check that rejects empty-string id", () => {
  assert.ok(
    routeSrc.includes("body.id.trim().length > 0"),
    "route must reject empty-string id as 'no id', not 'has id'"
  );
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
