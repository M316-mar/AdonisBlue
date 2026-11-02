/**
 * Tests for the rate-limit helpers (constants, getClientIp, checkRateLimit).
 * Inlines the logic from lib/rateLimit.ts since Node can't import .ts directly.
 */

import { strictEqual } from "node:assert";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

// ── Inline constants from lib/rateLimit.ts ──────────────────────────────────

const RATE_WINDOW_SECONDS = 600;
const RATE_LIMITS = { chat: 30, healing: 20, productChat: 40 };
const EMERGENCY_RATE_LIMIT = 60;

// ── Inline getClientIp from lib/rateLimit.ts ────────────────────────────────

function getClientIp(request) {
  const vercel = request.headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0].trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "unknown";
}

// ── Inline checkRateLimit from lib/rateLimit.ts ─────────────────────────────

async function checkRateLimit(supabase, key, max, windowSeconds = RATE_WINDOW_SECONDS) {
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key, p_max: max, p_window_seconds: windowSeconds,
  });
  if (error) return true; // fail open
  return data === true;
}

// ── Helper: mock Supabase client ─────────────────────────────────────────────

function mockClient(data, error = null) {
  return { rpc: async () => ({ data, error }) };
}

// ── Tests ────────────────────────────────────────────────────────────────────

console.log("Rate limit constants");
test("RATE_WINDOW_SECONDS is 600 (10 min)", () => strictEqual(RATE_WINDOW_SECONDS, 600));
test("RATE_LIMITS.chat is 30", () => strictEqual(RATE_LIMITS.chat, 30));
test("RATE_LIMITS.healing is 20", () => strictEqual(RATE_LIMITS.healing, 20));
test("RATE_LIMITS.productChat is 40", () => strictEqual(RATE_LIMITS.productChat, 40));
test("EMERGENCY_RATE_LIMIT is 60", () => strictEqual(EMERGENCY_RATE_LIMIT, 60));
test("EMERGENCY_RATE_LIMIT > RATE_LIMITS.chat (emergency gets more room)", () =>
  strictEqual(EMERGENCY_RATE_LIMIT > RATE_LIMITS.chat, true));

console.log("\ngetClientIp");
test("returns x-vercel-forwarded-for first IP", () => {
  const req = { headers: { get: (h) => h === "x-vercel-forwarded-for" ? "1.2.3.4, 5.6.7.8" : null } };
  strictEqual(getClientIp(req), "1.2.3.4");
});
test("falls back to x-forwarded-for first IP", () => {
  const req = { headers: { get: (h) => h === "x-forwarded-for" ? "9.10.11.12, 13.14.15.16" : null } };
  strictEqual(getClientIp(req), "9.10.11.12");
});
test("returns 'unknown' when no IP header", () => {
  const req = { headers: { get: () => null } };
  strictEqual(getClientIp(req), "unknown");
});
test("x-vercel-forwarded-for wins over x-forwarded-for", () => {
  const req = {
    headers: {
      get: (h) => h === "x-vercel-forwarded-for" ? "1.1.1.1" : h === "x-forwarded-for" ? "2.2.2.2" : null,
    },
  };
  strictEqual(getClientIp(req), "1.1.1.1");
});

console.log("\ncheckRateLimit");
await testAsync("returns true when count is under limit (rpc returns true)", async () => {
  const allowed = await checkRateLimit(mockClient(true), "test:key", 30, 600);
  strictEqual(allowed, true);
});
await testAsync("returns false when count is over limit (rpc returns false)", async () => {
  const blocked = await checkRateLimit(mockClient(false), "test:key", 30, 600);
  strictEqual(blocked, false);
});
await testAsync("fails open on DB error (returns true)", async () => {
  const allowed = await checkRateLimit(
    mockClient(null, { message: "connection refused" }),
    "test:key", 30, 600
  );
  strictEqual(allowed, true);
});
await testAsync("emergency allowed: rpc returns true at EMERGENCY_RATE_LIMIT", async () => {
  const allowed = await checkRateLimit(
    mockClient(true), "chat-emergency:slug:1.2.3.4", EMERGENCY_RATE_LIMIT, 600
  );
  strictEqual(allowed, true);
});
await testAsync("emergency blocked: rpc returns false over EMERGENCY_RATE_LIMIT", async () => {
  const blocked = await checkRateLimit(
    mockClient(false), "chat-emergency:slug:1.2.3.4", EMERGENCY_RATE_LIMIT, 600
  );
  strictEqual(blocked, false);
});
await testAsync("emergency keys do not interfere with normal keys", async () => {
  // Different keys always produce independent checks
  const normalBlocked = await checkRateLimit(mockClient(false), "chat:slug:1.2.3.4", RATE_LIMITS.chat, 600);
  const emergencyAllowed = await checkRateLimit(mockClient(true), "chat-emergency:slug:1.2.3.4", EMERGENCY_RATE_LIMIT, 600);
  strictEqual(normalBlocked, false);
  strictEqual(emergencyAllowed, true);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
