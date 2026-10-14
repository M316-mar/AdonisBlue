#!/usr/bin/env node
/**
 * schema-check.mjs — AdonisBlue DB / code column cross-check
 *
 * Fetches the real column list from Supabase information_schema, then scans
 * every .from("table") call in app/ and lib/ for columns used in .select(),
 * .update(), .insert(), .eq(), .order(), .is(), .not() and reports any column
 * that doesn't exist in the DB.
 *
 * Usage:  node scripts/schema-check.mjs
 * Reads:  .env.local  (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, resolve } from "path";

// ── 1. Load env ────────────────────────────────────────────────────────────────
const root = resolve(new URL(".", import.meta.url).pathname, "..");
const envLines = readFileSync(join(root, ".env.local"), "utf8").split("\n");
const env = {};
for (const line of envLines) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}
const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"];
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

// ── 2. Fetch real schema ───────────────────────────────────────────────────────
async function getDbSchema() {
  // Use Accept-Profile to query information_schema via PostgREST
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/columns?table_schema=eq.public&select=table_name,column_name,data_type,is_nullable&limit=3000`,
    {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Accept-Profile": "information_schema",
        Accept: "application/json",
      },
    }
  );
  if (r.ok) {
    const data = await r.json();
    if (Array.isArray(data) && data.length > 0) return data;
  }

  // Fallback: OpenAPI spec at the root
  const r2 = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (r2.ok) {
    const spec = await r2.json();
    const cols = [];
    for (const [tableName, def] of Object.entries(spec.definitions ?? {})) {
      for (const colName of Object.keys(def.properties ?? {})) {
        cols.push({ table_name: tableName, column_name: colName });
      }
    }
    if (cols.length > 0) return cols;
  }

  throw new Error("Could not fetch schema from Supabase — check credentials.");
}

// ── 3. Walk source files ───────────────────────────────────────────────────────
function walk(dir, exts = [".ts", ".tsx"]) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".") || entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) results.push(...walk(full, exts));
    else if (exts.some(e => full.endsWith(e))) results.push(full);
  }
  return results;
}

// ── 4. Extract column references ──────────────────────────────────────────────
// Strategy: find EVERY .from("table") in a file, then within a short window
// after it collect all column references from .select / .update / .insert /
// .eq / .order / .is / .not / .neq.  We do NOT search backwards from a column
// to a table — we forward-scan from the table anchor instead.

const IGNORED_KEYS = new Set([
  "id", "created_at", "updated_at", "inserted_at",
  // JS object meta
  "type", "status", "error", "message", "data", "count",
  // PostgREST operators / result fields
  "select", "insert", "update", "delete", "upsert",
  "single", "maybeSingle", "limit", "range",
  // values, not keys
  "true", "false", "null", "undefined",
]);

function extractRefs(files) {
  const refs = [];

  for (const filePath of files) {
    const relPath = filePath.replace(root + "/", "");
    const src = readFileSync(filePath, "utf8");
    const lines = src.split("\n");

    // Forward scan: find .from("table"), then collect from the following ~25 lines
    for (let i = 0; i < lines.length; i++) {
      const tableMatch = lines[i].match(/\.from\(\s*["'`]([^"'`]+)["'`]/);
      if (!tableMatch) continue;
      const table = tableMatch[1];

      // Scan up to 25 lines ahead for column references
      const end = Math.min(lines.length, i + 25);
      for (let j = i; j < end; j++) {
        const line = lines[j];
        const lineNum = j + 1;

        // .select("col1, col2, embedded(col3, col4)")
        const selectM = line.match(/\.select\(\s*["'`]([^"'`]+)["'`]/);
        if (selectM) {
          parseSelect(selectM[1], table, relPath, lineNum, refs);
        }

        // .eq("col"), .neq, .not, .is, .order, .gt, .gte, .lt, .lte, .in, .contains
        const filterM = line.match(/\.(eq|neq|not|is|order|gt|gte|lt|lte|in|contains)\(\s*["'`]([^"'`,"'`]+)["'`]/);
        if (filterM) {
          const col = filterM[2].trim();
          if (isColName(col)) {
            refs.push({ file: relPath, line: lineNum, table, column: col, kind: "filter" });
          }
        }

        // .update({ col: ..., col2: ... }) — single line
        const updateM = line.match(/\.update\(\s*\{([^}]+)\}/);
        if (updateM) {
          for (const kv of updateM[1].matchAll(/\b([a-z_][a-z0-9_]*)\s*:/g)) {
            if (isColName(kv[1])) refs.push({ file: relPath, line: lineNum, table, column: kv[1], kind: "update" });
          }
        }

        // .insert({ ... }) — single line
        const insertM = line.match(/\.insert\(\s*\{([^}]+)\}/);
        if (insertM) {
          for (const kv of insertM[1].matchAll(/\b([a-z_][a-z0-9_]*)\s*:/g)) {
            if (isColName(kv[1])) refs.push({ file: relPath, line: lineNum, table, column: kv[1], kind: "insert" });
          }
        }
      }

      // Also handle multi-line insert/update objects anchored at this .from()
      const ahead = src.slice(
        src.split("\n").slice(0, i).join("\n").length,
        src.split("\n").slice(0, Math.min(lines.length, i + 30)).join("\n").length
      );
      const multiM = ahead.match(/\.(insert|update)\(\s*\{([^}]*)\}/s);
      if (multiM) {
        const objBody = multiM[2];
        const lineNum = i + 1;
        for (const kv of objBody.matchAll(/\b([a-z_][a-z0-9_]*)\s*:/g)) {
          if (isColName(kv[1])) {
            refs.push({ file: relPath, line: lineNum, table, column: kv[1], kind: multiM[1] });
          }
        }
      }
    }
  }

  return refs;
}

function isColName(s) {
  return /^[a-z_][a-z0-9_]*$/.test(s) && !IGNORED_KEYS.has(s) && s.length > 1;
}

function parseSelect(selectStr, table, file, lineNum, refs) {
  const tableStack = [table];
  let current = "";
  let depth = 0;

  const flush = () => {
    const col = current.trim().replace(/^[!*]/, "").split("(")[0].trim();
    if (col && isColName(col)) {
      refs.push({ file, line: lineNum, table: tableStack[tableStack.length - 1], column: col, kind: "select" });
    }
    current = "";
  };

  for (const ch of selectStr) {
    if (ch === "(") {
      // whatever is in `current` is the embedded table name
      const embTable = current.trim().split(/[\s,!]/).filter(Boolean).pop() || current.trim();
      tableStack.push(embTable);
      depth++;
      current = "";
    } else if (ch === ")") {
      flush();
      depth--;
      tableStack.pop();
    } else if (ch === "," || ch === " ") {
      flush();
    } else {
      current += ch;
    }
  }
  flush();
}

// ── 5. Main ────────────────────────────────────────────────────────────────────
console.log("Fetching DB schema from Supabase…");
let schemaRows;
try {
  schemaRows = await getDbSchema();
} catch (e) {
  console.error("❌ Schema fetch failed:", e.message);
  process.exit(1);
}

// Build column map and table set
const dbSchema = new Map(); // table -> Set<column>
const dbTables = new Set();
for (const row of schemaRows) {
  const t = row.table_name;
  dbTables.add(t);
  if (!dbSchema.has(t)) dbSchema.set(t, new Set());
  dbSchema.get(t).add(row.column_name);
}

console.log(`Schema loaded: ${dbTables.size} tables, ${schemaRows.length} columns.\n`);

const appFiles = [
  ...walk(join(root, "app")),
  ...walk(join(root, "lib")),
];

const allRefs = extractRefs(appFiles);

// Deduplicate and check
const seenKey = new Set();
const missingCols = []; // column exists on table, but column is wrong
const missingTables = new Set(); // table doesn't exist at all

for (const ref of allRefs) {
  const key = `${ref.table}:${ref.column}:${ref.file}:${ref.line}`;
  if (seenKey.has(key)) continue;
  seenKey.add(key);

  if (!dbTables.has(ref.table)) {
    missingTables.add(ref.table);
    continue;
  }

  const cols = dbSchema.get(ref.table);
  if (!cols.has(ref.column)) {
    missingCols.push(ref);
  }
}

// ── 6. Filter out known non-public tables (auth schema, storage, etc.) ────────
// These are referenced via Supabase helpers, not direct PostgREST .from() calls.
// Add any table here that lives outside the public schema or is always safe to skip.
const SKIP_TABLES = new Set([
  "users",          // auth.users — accessed only via supabase.auth, not .from()
  "identities",     // auth.identities
  "sessions",       // auth.sessions
  "objects",        // storage.objects
  "buckets",        // storage.buckets
]);

// Tables added by a pending migration that hasn't been run yet.
// Remove a table from here once its migration has been applied to the DB.
const KNOWN_PENDING_TABLES = new Set([
  // "example_table",
]);

const filteredMissingTables = [...missingTables].filter(
  t => !SKIP_TABLES.has(t) && !KNOWN_PENDING_TABLES.has(t)
);

// ── 7. Output ──────────────────────────────────────────────────────────────────
const W = "=".repeat(90);

console.log(W);
console.log("MISSING TABLES (table doesn't exist at all)");
console.log(W);
if (filteredMissingTables.length === 0) {
  console.log("✅ None");
} else {
  for (const t of filteredMissingTables.sort()) console.log(`  ❌ ${t}`);
}

console.log("\n" + W);
console.log("MISSING COLUMNS (table exists, column does not)");
console.log(W);

if (missingCols.length === 0) {
  console.log("✅ None");
} else {
  const grouped = new Map();
  for (const r of missingCols) {
    const k = `${r.table}.${r.column}`;
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k).push(r);
  }
  const rows = [...grouped.entries()].sort();
  for (const [key, refs] of rows) {
    const [table, column] = key.split(".");
    const locs = [...new Set(refs.map(r => `${r.file}:${r.line}`))].slice(0, 3).join("  ");
    const kinds = [...new Set(refs.map(r => r.kind))].join(", ");
    console.log(`  ❌ ${key.padEnd(45)} [${kinds}]`);
    console.log(`       ${locs}`);
  }
}

console.log("\n" + W);
console.log("FULL SCHEMA");
console.log(W);
for (const [table, cols] of [...dbSchema.entries()].sort()) {
  console.log(`\n  ${table}:`);
  console.log(`    ${[...cols].sort().join(", ")}`);
}

// Exit 1 if any real mismatches found — causes `npm run check` to fail in CI/pre-push
const hasErrors = filteredMissingTables.length > 0 || missingCols.length > 0;
if (hasErrors) {
  console.error(`\n❌ schema-check found ${filteredMissingTables.length} missing table(s) and ${missingCols.length} missing column(s). Fix before pushing.`);
  process.exit(1);
} else {
  console.log("\n✅ schema-check passed — all code references match the DB.");
}
