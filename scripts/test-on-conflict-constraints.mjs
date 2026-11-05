/**
 * Checks that every .upsert(..., { onConflict: "..." }) in the codebase has a
 * matching UNIQUE constraint or unique index in supabase/migrations.
 *
 * Rules:
 *  - onConflict: "id" is always valid (primary key on every table).
 *  - Everything else must appear as a UNIQUE INDEX, UNIQUE constraint, or
 *    PRIMARY KEY on the same column(s) in a migration file.
 *  - Known constraints that exist in the DB but predate our migration files
 *    are listed in KNOWN_CONSTRAINTS below.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const ROOT = new URL("..", import.meta.url).pathname;
const APP_DIR = join(ROOT, "app");
const MIGRATIONS_DIR = join(ROOT, "supabase/migrations");

// Constraints we know exist in the production DB but were created before
// our migration-file convention (or via Supabase UI). Add here when you add
// a new upsert whose constraint predates migrations, with a reason.
const KNOWN_CONSTRAINTS = new Map([
  // bots.nurse_id — primary key set when the table was first created via UI.
  ["bots:nurse_id", "bots.nurse_id is the primary key; predates migration files"],
]);

// ── 1. Collect all onConflict usages from source ─────────────────────────────

function walkTs(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walkTs(full));
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) files.push(full);
  }
  return files;
}

// Match: .from("table").upsert(..., { onConflict: "cols" })
// Limit span to 600 chars so we never bleed across unrelated .from() calls.
const UPSERT_RE = /\.from\(\s*["']([^"']+)["']\s*\)[^;]{0,600}?onConflict\s*:\s*["']([^"']+)["']/g;

const usages = []; // { file, table, columns[] }

for (const file of walkTs(APP_DIR)) {
  const src = readFileSync(file, "utf8");
  let m;
  UPSERT_RE.lastIndex = 0;
  while ((m = UPSERT_RE.exec(src)) !== null) {
    const table = m[1];
    const cols = m[2].split(",").map(c => c.trim()).sort();
    usages.push({ file: file.replace(ROOT, ""), table, cols });
  }
}

// ── 2. Collect unique constraints / indexes from migrations ──────────────────

const migrationSrc = readdirSync(MIGRATIONS_DIR)
  .filter(f => f.endsWith(".sql"))
  .map(f => readFileSync(join(MIGRATIONS_DIR, f), "utf8"))
  .join("\n");

// Patterns we look for (case-insensitive):
//   UNIQUE (col1, col2)                       — inline column constraint
//   UNIQUE (col1,col2)
//   CREATE UNIQUE INDEX ... ON table (col1, col2)
//   ADD CONSTRAINT ... UNIQUE (col1, col2)
//   PRIMARY KEY (col1, col2)

function extractConstraints(sql) {
  const constraints = new Set(); // "table:col1,col2" (cols sorted)

  // CREATE UNIQUE INDEX [IF NOT EXISTS] name ON [public.]table (cols)
  const idxRe = /CREATE\s+UNIQUE\s+INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?\S+\s+ON\s+(?:public\.)?(\w+)\s*\(([^)]+)\)/gi;
  let m;
  while ((m = idxRe.exec(sql)) !== null) {
    const table = m[1].toLowerCase();
    const cols = m[2].split(",").map(c => c.trim().toLowerCase()).sort();
    constraints.add(`${table}:${cols.join(",")}`);
  }

  // UNIQUE (cols) — inline, preceded by table context via ALTER TABLE or CREATE TABLE
  // We look for ALTER TABLE ... ADD CONSTRAINT ... UNIQUE (cols)
  const addRe = /ALTER\s+TABLE\s+(?:public\.)?(\w+)[^;]*?ADD\s+CONSTRAINT\s+\S+\s+UNIQUE\s*\(([^)]+)\)/gi;
  while ((m = addRe.exec(sql)) !== null) {
    const table = m[1].toLowerCase();
    const cols = m[2].split(",").map(c => c.trim().toLowerCase()).sort();
    constraints.add(`${table}:${cols.join(",")}`);
  }

  return constraints;
}

const knownFromMigrations = extractConstraints(migrationSrc);

// ── 3. Check each usage ───────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

console.log("\nonConflict constraint coverage check\n");

for (const { file, table, cols } of usages) {
  // "id" is always a primary key
  if (cols.length === 1 && cols[0] === "id") {
    console.log(`  ✓ ${table} (${cols.join(",")})  [primary key]  ${file}`);
    passed++;
    continue;
  }

  const key = `${table}:${cols.join(",")}`;

  if (knownFromMigrations.has(key)) {
    console.log(`  ✓ ${table} (${cols.join(",")})  [migration]  ${file}`);
    passed++;
    continue;
  }

  if (KNOWN_CONSTRAINTS.has(key)) {
    console.log(`  ✓ ${table} (${cols.join(",")})  [known pre-migration: ${KNOWN_CONSTRAINTS.get(key)}]  ${file}`);
    passed++;
    continue;
  }

  console.error(`  ✗ ${table} (${cols.join(",")})  NO matching unique constraint found  ${file}`);
  failed++;
}

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  console.error("Fix: add a migration with CREATE UNIQUE INDEX ... ON <table> (<cols>),");
  console.error("or add to KNOWN_CONSTRAINTS if the constraint predates migration files.");
  process.exit(1);
}
