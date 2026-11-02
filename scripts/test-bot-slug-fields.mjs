/**
 * Asserts that /api/bot/[slug] does NOT expose private fields.
 * Checks the PUBLIC_BOT_FIELDS allowlist directly without a network call.
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

// ── Inline the allowlist from the route ──────────────────────────────────────

const PUBLIC_BOT_FIELDS =
  "practice_name, city, instagram, facebook, tiktok, website, other_social, " +
  "bot_name, greeting, tone, booking_link, cancellation_policy, aftercare, numbing_method, " +
  "previous_work_policy, touch_up_policy, same_day_consultation, deposit_info, forward_questions, " +
  "services, logo_image, logo_data_url, logo_url, brand_name_image, bot_name_font, " +
  "bubble_attention_message, photos, frozen, nurse_name";

const fields = new Set(PUBLIC_BOT_FIELDS.split(",").map((f) => f.trim()));

// ── Private fields that must NEVER appear ────────────────────────────────────

const PRIVATE_FIELDS = [
  "id",
  "nurse_id",
  "nurse_email",
  "notification_email",
  "alert_email",
  "alert_email_verified",
  "alert_phone",
  "alert_verification_token",
  "pending_alert_email",
  "stripe_customer_id",
  "stripe_subscription_id",
  "stripe_price_id",
  "created_at",
  "state",
  "slug",          // already in URL — no need to echo it back
  "chat_theme",
  "primary_color",
  "location",
  "business_hours",
];

console.log("bot/[slug]: public field allowlist");

for (const f of PRIVATE_FIELDS) {
  test(`does NOT include "${f}"`, () => {
    strictEqual(fields.has(f), false, `"${f}" must not be in PUBLIC_BOT_FIELDS`);
  });
}

// ── Fields the chat page requires must be present ────────────────────────────

const REQUIRED_FIELDS = [
  "practice_name", "city",
  "instagram", "facebook", "tiktok", "website", "other_social",
  "bot_name", "greeting", "tone", "booking_link",
  "cancellation_policy", "aftercare", "numbing_method",
  "previous_work_policy", "touch_up_policy", "same_day_consultation",
  "deposit_info", "forward_questions", "services",
  "logo_image", "logo_data_url", "logo_url", "brand_name_image",
  "bot_name_font", "bubble_attention_message", "photos", "frozen", "nurse_name",
];

console.log("\nbot/[slug]: required public fields present");
for (const f of REQUIRED_FIELDS) {
  test(`includes "${f}"`, () => {
    strictEqual(fields.has(f), true, `"${f}" is missing from PUBLIC_BOT_FIELDS`);
  });
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
