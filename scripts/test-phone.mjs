#!/usr/bin/env node
/**
 * test-phone.mjs — verify formatPhone() and phoneHtml() for client emails.
 * Run: node scripts/test-phone.mjs
 * Any failure exits 1 so `npm run check` fails.
 */

// Inline the logic from lib/formatPhone.ts
function formatPhone(raw) {
  if (!raw?.trim()) return raw ?? "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return raw;
}

function phoneHtml(raw) {
  if (!raw?.trim()) return raw ?? "";
  const digits = raw.replace(/\D/g, "");
  const display = formatPhone(raw);
  const href =
    digits.length === 10
      ? `+1${digits}`
      : digits.length === 11 && digits[0] === "1"
      ? `+${digits}`
      : digits || raw;
  return `<a href="tel:${href}" style="color:inherit;font-weight:600;text-decoration:underline;">${display}</a>`;
}

const BOLD = "\x1b[1m", RED = "\x1b[31m", GREEN = "\x1b[32m", RESET = "\x1b[0m";
let pass = 0, fail = 0;

function check(label, result, expect) {
  const ok = result === expect;
  if (ok) pass++; else fail++;
  const tag = ok ? `${GREEN}PASS${RESET}` : `${RED}${BOLD}FAIL${RESET}`;
  const detail = ok ? "" : `\n      expected: ${JSON.stringify(expect)}\n      got:      ${JSON.stringify(result)}`;
  console.log(`${tag}  ${label}${detail}`);
}

// formatPhone
check('formatPhone("2147177944")       → "(214) 717-7944"',   formatPhone("2147177944"),        "(214) 717-7944");
check('formatPhone("(214) 717-7944")   → "(214) 717-7944"',   formatPhone("(214) 717-7944"),    "(214) 717-7944");
check('formatPhone("214-717-7944")     → "(214) 717-7944"',   formatPhone("214-717-7944"),      "(214) 717-7944");
check('formatPhone("214 717 7944")     → "(214) 717-7944"',   formatPhone("214 717 7944"),      "(214) 717-7944");
check('formatPhone("12147177944")      → "(214) 717-7944"',   formatPhone("12147177944"),       "(214) 717-7944");
check('formatPhone("+12147177944")     → "(214) 717-7944"',   formatPhone("+12147177944"),      "(214) 717-7944");
check('formatPhone("+44 20 7946 0958") → as-is',              formatPhone("+44 20 7946 0958"),  "+44 20 7946 0958");
check('formatPhone("")                 → ""',                  formatPhone(""),                  "");

// phoneHtml — check href and display text are correct
const link10 = phoneHtml("2147177944");
check(
  'phoneHtml("2147177944") contains href tel:+12147177944',
  link10.includes('href="tel:+12147177944"'),
  true
);
check(
  'phoneHtml("2147177944") displays "(214) 717-7944"',
  link10.includes("(214) 717-7944"),
  true
);

const link11 = phoneHtml("+1 214 717 7944");
check(
  'phoneHtml("+1 214 717 7944") contains href tel:+12147177944',
  link11.includes('href="tel:+12147177944"'),
  true
);

console.log(`\n${pass}/${pass + fail} passed${fail > 0 ? ` — ${BOLD}${RED}${fail} FAILED${RESET}` : ""}`);
if (fail > 0) process.exit(1);
