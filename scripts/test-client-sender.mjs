// Tests for lib/clientEmailSender.ts logic (pure JS, no imports needed)

function sanitizeFromName(raw) {
  if (!raw) return "AdonisBlue";
  const cleaned = raw
    .replace(/["'`]/g, "")
    .replace(/[<>]/g, "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 60)
    .trim();
  return cleaned || "AdonisBlue";
}

function getClientSender(bot) {
  const from_name = sanitizeFromName(bot.practice_name);
  const reply_to =
    bot.alert_email_verified && bot.alert_email
      ? bot.alert_email
      : bot.notification_email
      ? bot.notification_email
      : undefined;
  return { from_name, reply_to };
}

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  if (actual === expected) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}`);
    console.error(`    expected: ${JSON.stringify(expected)}`);
    console.error(`    actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

console.log("\nsanitizeFromName:");
assert("strips double quotes",          sanitizeFromName('Glow "Studio"'),       "Glow Studio");
assert("strips single quotes",          sanitizeFromName("Glow 'Studio'"),       "Glow Studio");
assert("strips backticks",              sanitizeFromName("Glow `Studio`"),       "Glow Studio");
assert("strips angle brackets",         sanitizeFromName("<Glow Studio>"),       "Glow Studio");
assert("strips newlines",               sanitizeFromName("Glow\nStudio"),        "Glow Studio");
assert("strips carriage returns",       sanitizeFromName("Glow\r\nStudio"),      "Glow Studio");
assert("trims whitespace",              sanitizeFromName("  Glow Studio  "),     "Glow Studio");
assert("caps at 60 chars",              sanitizeFromName("A".repeat(70)).length <= 60, true);
assert("null → fallback",               sanitizeFromName(null),                  "AdonisBlue");
assert("undefined → fallback",          sanitizeFromName(undefined),             "AdonisBlue");
assert("empty string → fallback",       sanitizeFromName(""),                    "AdonisBlue");
assert("only quotes → fallback",        sanitizeFromName(`"'\``),                "AdonisBlue");

console.log("\ngetClientSender reply_to:");
assert("verified alert_email used",
  getClientSender({ alert_email: "a@x.com", alert_email_verified: true, notification_email: "b@x.com" }).reply_to,
  "a@x.com"
);
assert("unverified alert_email → notification_email",
  getClientSender({ alert_email: "a@x.com", alert_email_verified: false, notification_email: "b@x.com" }).reply_to,
  "b@x.com"
);
assert("no alert_email → notification_email",
  getClientSender({ alert_email: null, alert_email_verified: null, notification_email: "b@x.com" }).reply_to,
  "b@x.com"
);
assert("nothing → undefined",
  getClientSender({ alert_email: null, alert_email_verified: null, notification_email: null }).reply_to,
  undefined
);
assert("empty bot → fallback name",
  getClientSender({}).from_name,
  "AdonisBlue"
);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
