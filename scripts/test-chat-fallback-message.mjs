/**
 * Tests that chat/healing fallback messages include the 911 line and nurse contact.
 * Run: node scripts/test-chat-fallback-message.mjs
 */
import assert from "node:assert/strict";

// Inline the helper logic (mirrors what's in the route files)
function chatFallbackReply(botConfig) {
  const nurseFirst = (typeof botConfig.nurse_name === "string" ? botConfig.nurse_name.trim().split(/\s+/)[0] : "") || null;
  const phone = typeof botConfig.phone_public === "string" && botConfig.phone_public.trim() ? botConfig.phone_public.trim() : null;
  const contactLine = phone
    ? ` If this is urgent, call ${nurseFirst ?? "your nurse"} at ${phone}.`
    : "";
  return `Sorry, I'm having trouble right now.${contactLine} If you have trouble breathing, chest pain, or vision changes, call 911.`;
}

function healingFallbackMessage(nurseFirst, phone) {
  const contactLine = phone
    ? ` If this is urgent, call ${nurseFirst ?? "your nurse"} at ${phone}.`
    : "";
  return `Sorry, I'm having trouble right now.${contactLine} If you have trouble breathing, chest pain, or vision changes, call 911.`;
}

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); failed++; }
}

console.log("\nChat/healing fallback message tests\n");

// 1. AI failure includes 911 line
test("chat: AI failure response includes 911 line", () => {
  const msg = chatFallbackReply({ nurse_name: "Emma Smith", phone_public: "312-555-0100" });
  assert.ok(msg.includes("911"), "must include 911");
});

// 2. AI failure includes nurse name when available
test("chat: includes nurse first name when available", () => {
  const msg = chatFallbackReply({ nurse_name: "Emma Smith", phone_public: "312-555-0100" });
  assert.ok(msg.includes("Emma"), "must include nurse first name");
});

// 3. AI failure includes phone when available
test("chat: includes phone when available", () => {
  const msg = chatFallbackReply({ nurse_name: "Emma Smith", phone_public: "312-555-0100" });
  assert.ok(msg.includes("312-555-0100"), "must include phone");
});

// 4. No phone → no contact line, still has 911
test("chat: no phone → no contact line, 911 still present", () => {
  const msg = chatFallbackReply({ nurse_name: "Emma Smith" });
  assert.ok(msg.includes("911"));
  assert.ok(!msg.includes("call Emma at"), "must not have contact line without phone");
});

// 5. Empty botConfig → still has 911
test("chat: empty botConfig → still has 911", () => {
  const msg = chatFallbackReply({});
  assert.ok(msg.includes("911"));
});

// 6. Healing: has phone → includes both contact and 911
test("healing: has phone → includes contact and 911", () => {
  const msg = healingFallbackMessage("Sara", "773-555-0199");
  assert.ok(msg.includes("911"));
  assert.ok(msg.includes("Sara"));
  assert.ok(msg.includes("773-555-0199"));
});

// 7. Healing: null name → "your nurse"
test("healing: null nurse name → 'your nurse'", () => {
  const msg = healingFallbackMessage(null, "773-555-0199");
  assert.ok(msg.includes("your nurse"));
});

// 8. Healing: null phone → no contact line
test("healing: null phone → no contact line, 911 still present", () => {
  const msg = healingFallbackMessage("Sara", null);
  assert.ok(msg.includes("911"));
  assert.ok(!msg.includes("call Sara at"));
});

// 9. Message starts with "Sorry"
test("chat: message starts with 'Sorry'", () => {
  const msg = chatFallbackReply({});
  assert.ok(msg.startsWith("Sorry"));
});

// 10. Does NOT say "Something went wrong" (old generic message gone)
test("chat: does not contain old generic error text", () => {
  const msg = chatFallbackReply({ nurse_name: "Emma", phone_public: "312-555-0100" });
  assert.ok(!msg.includes("Something went wrong"));
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
