#!/usr/bin/env node
/**
 * test-names.mjs — verify firstName() capitalization for client-facing greetings.
 *
 * Run: node scripts/test-names.mjs
 * Any failure exits 1 so `npm run check` fails.
 */

// Inline the logic from lib/firstName.ts
function firstName(name, fallback) {
  if (!name?.trim()) return fallback;
  const word = name.trim().split(/\s+/)[0];
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

const cases = [
  // Capitalization
  { label: 'firstName("maria", "there") → "Maria"',           result: firstName("maria", "there"),           expect: "Maria" },
  { label: 'firstName("MARIA", "there") → "Maria"',           result: firstName("MARIA", "there"),           expect: "Maria" },
  { label: 'firstName("Maria", "there") → "Maria"',           result: firstName("Maria", "there"),           expect: "Maria" },
  // Full name → first word only
  { label: 'firstName("maria jose", "there") → "Maria"',      result: firstName("maria jose", "there"),      expect: "Maria" },
  { label: 'firstName("Tina Farias", "there") → "Tina"',      result: firstName("Tina Farias", "there"),     expect: "Tina" },
  { label: 'firstName("test client", "there") → "Test"',      result: firstName("test client", "there"),     expect: "Test" },
  // Fallbacks
  { label: 'firstName(null, "there") → "there"',              result: firstName(null, "there"),              expect: "there" },
  { label: 'firstName("", "beautiful") → "beautiful"',        result: firstName("", "beautiful"),            expect: "beautiful" },
  { label: 'firstName("  ", "beautiful") → "beautiful"',      result: firstName("  ", "beautiful"),          expect: "beautiful" },
];

const BOLD = "\x1b[1m", RED = "\x1b[31m", GREEN = "\x1b[32m", RESET = "\x1b[0m";
let pass = 0, fail = 0;

for (const { label, result, expect } of cases) {
  const ok = result === expect;
  if (ok) pass++; else fail++;
  const tag = ok ? `${GREEN}PASS${RESET}` : `${RED}${BOLD}FAIL${RESET}`;
  const detail = ok ? "" : `  (expected: "${expect}", got: "${result}")`;
  console.log(`${tag}  ${label}${detail}`);
}

console.log(`\n${pass}/${pass + fail} passed${fail > 0 ? ` — ${BOLD}${RED}${fail} FAILED${RESET}` : ""}`);
if (fail > 0) process.exit(1);
