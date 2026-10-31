// Tests: DEFAULT_RETURN_DAYS applied when reminder_days is null or no procedure

const DEFAULT_RETURN_DAYS = 180; // must match lib/reminderDate.ts

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

// Simulate what treatment-reminders cron does
function resolveReminderDays(procedure) {
  return procedure?.reminder_days ?? DEFAULT_RETURN_DAYS;
}

// Simulate the rebook date default in the log form
function rebookDateDays(proc) {
  return proc?.reminder_days ?? DEFAULT_RETURN_DAYS;
}

console.log("\ntreatment-reminders: reminder_days resolution:");
assert("procedure with reminder_days=90 → 90",
  resolveReminderDays({ reminder_days: 90 }), 90);
assert("procedure with reminder_days=null → DEFAULT_RETURN_DAYS",
  resolveReminderDays({ reminder_days: null }), DEFAULT_RETURN_DAYS);
assert("no procedure (null) → DEFAULT_RETURN_DAYS",
  resolveReminderDays(null), DEFAULT_RETURN_DAYS);
assert("no procedure (undefined) → DEFAULT_RETURN_DAYS",
  resolveReminderDays(undefined), DEFAULT_RETURN_DAYS);

console.log("\nlog form: rebook date default:");
assert("proc with reminder_days=28 → 28",
  rebookDateDays({ reminder_days: 28 }), 28);
assert("proc with reminder_days=null → DEFAULT_RETURN_DAYS",
  rebookDateDays({ reminder_days: null }), DEFAULT_RETURN_DAYS);
assert("no proc → DEFAULT_RETURN_DAYS",
  rebookDateDays(undefined), DEFAULT_RETURN_DAYS);

console.log("\nprocedure API: reminder_days validation:");
// Simulate the API check
function apiCheck(approved, reminder_days) {
  if (approved && (reminder_days == null || !Number.isInteger(reminder_days) || reminder_days <= 0)) {
    return { ok: false, error: "Set when clients come back before approving." };
  }
  return { ok: true };
}

assert("approved + valid reminder_days=90 → ok",
  apiCheck(true, 90).ok, true);
assert("approved + reminder_days=null → rejected",
  apiCheck(true, null).ok, false);
assert("approved + reminder_days=undefined → rejected",
  apiCheck(true, undefined).ok, false);
assert("approved + reminder_days=0 → rejected",
  apiCheck(true, 0).ok, false);
assert("approved + reminder_days=180 → ok",
  apiCheck(true, 180).ok, true);
assert("not approved + reminder_days=null → ok (unapproved save allowed)",
  apiCheck(false, null).ok, true);

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
