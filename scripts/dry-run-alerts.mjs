#!/usr/bin/env node
/**
 * dry-run-alerts.mjs — diagnostic script proving the alert pipeline works end-to-end.
 *
 * Run: node scripts/dry-run-alerts.mjs
 *
 * What it checks:
 *   1. Reads recent healing_chats + conversations rows (flagged=true and any status)
 *      for a NURSE_ID you pass as an env var, and shows their flagged/status/nurse_id.
 *   2. Simulates the assistant/context query filter (flagged=true AND status="active")
 *      and shows which rows WOULD appear vs. which are missing.
 *   3. Exits 0 (all flagged rows have status="active") or 1 (some would be missed).
 *
 * Usage:
 *   NURSE_ID=<uuid> node scripts/dry-run-alerts.mjs
 *
 * Or with a .env.local loaded (via dotenv):
 *   node --require dotenv/config scripts/dry-run-alerts.mjs  (set NURSE_ID in .env.local)
 *
 * Reads env vars from .env.local automatically when dotenv is available.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// ── Load .env.local ──────────────────────────────────────────────────────────
const envPath = resolve(process.cwd(), ".env.local");
try {
  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  // no .env.local — rely on env vars already set
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NURSE_ID = process.env.NURSE_ID;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.");
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY);

const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function row(label, value, warn = false) {
  const color = warn ? YELLOW : DIM;
  console.log(`  ${color}${label}:${RESET} ${value ?? "(null)"}`);
}

async function main() {
  console.log(`\n${BOLD}=== AdonisBlue Alert Pipeline Diagnostic ===${RESET}\n`);

  if (!NURSE_ID) {
    console.log(`${YELLOW}No NURSE_ID set — showing ALL recent flagged rows across all nurses.${RESET}`);
    console.log(`${DIM}Set NURSE_ID=<uuid> to filter to a specific nurse.${RESET}\n`);
  }

  // ── 1. healing_chats: all flagged rows ───────────────────────────────────
  console.log(`${BOLD}── healing_chats (flagged=true, last 7 days) ──${RESET}`);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let hcQuery = db
    .from("healing_chats")
    .select("id, client_name, nurse_id, flagged, status, flagged_message, updated_at")
    .eq("flagged", true)
    .gte("updated_at", sevenDaysAgo)
    .order("updated_at", { ascending: false });
  if (NURSE_ID) hcQuery = hcQuery.eq("nurse_id", NURSE_ID);

  const { data: hcRows, error: hcErr } = await hcQuery;
  if (hcErr) { console.error(`${RED}ERROR querying healing_chats:${RESET}`, hcErr.message); process.exit(1); }

  if (!hcRows?.length) {
    console.log(`  ${DIM}(no flagged rows in the last 7 days)${RESET}`);
  } else {
    for (const r of hcRows) {
      const visible = r.flagged === true && r.status === "active";
      const icon = visible ? `${GREEN}✓ VISIBLE${RESET}` : `${RED}${BOLD}✗ HIDDEN${RESET}`;
      console.log(`\n  ${icon}  client: ${r.client_name ?? "(blank)"}`);
      row("id", r.id);
      row("nurse_id", r.nurse_id);
      row("flagged", String(r.flagged), r.flagged !== true);
      row("status", r.status, r.status !== "active");
      row("flagged_message", (r.flagged_message ?? "").slice(0, 80));
      row("updated_at", r.updated_at);
      if (!visible) {
        console.log(`  ${RED}  ^ This alert emails the nurse but WOULD NOT show in the Assistant.${RESET}`);
        if (r.status !== "active") console.log(`  ${RED}    status="${r.status}" — must be "active".${RESET}`);
        if (r.flagged !== true) console.log(`  ${RED}    flagged=${r.flagged} — must be true.${RESET}`);
      }
    }
  }

  // ── 2. conversations: all flagged rows ───────────────────────────────────
  console.log(`\n${BOLD}── conversations (flagged=true, last 7 days) ──${RESET}`);
  let cvQuery = db
    .from("conversations")
    .select("id, client_name, nurse_id, flagged, status, flagged_message, created_at")
    .eq("flagged", true)
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false });
  if (NURSE_ID) cvQuery = cvQuery.eq("nurse_id", NURSE_ID);

  const { data: cvRows, error: cvErr } = await cvQuery;
  if (cvErr) { console.error(`${RED}ERROR querying conversations:${RESET}`, cvErr.message); process.exit(1); }

  if (!cvRows?.length) {
    console.log(`  ${DIM}(no flagged rows in the last 7 days)${RESET}`);
  } else {
    for (const r of cvRows) {
      const visible = r.flagged === true && r.status === "active";
      const icon = visible ? `${GREEN}✓ VISIBLE${RESET}` : `${RED}${BOLD}✗ HIDDEN${RESET}`;
      console.log(`\n  ${icon}  client: ${r.client_name ?? "(blank)"}`);
      row("id", r.id);
      row("nurse_id", r.nurse_id);
      row("flagged", String(r.flagged), r.flagged !== true);
      row("status", r.status, r.status !== "active");
      row("flagged_message", (r.flagged_message ?? "").slice(0, 80));
      row("created_at", r.created_at);
      if (!visible) {
        console.log(`  ${RED}  ^ This alert emails the nurse but WOULD NOT show in the Assistant.${RESET}`);
        if (r.status !== "active") console.log(`  ${RED}    status="${r.status}" — must be "active".${RESET}`);
        if (r.flagged !== true) console.log(`  ${RED}    flagged=${r.flagged} — must be true.${RESET}`);
      }
    }
  }

  // ── 3. Summary ───────────────────────────────────────────────────────────
  const allRows = [...(hcRows ?? []), ...(cvRows ?? [])];
  const hidden = allRows.filter(r => !(r.flagged === true && r.status === "active"));
  const visible = allRows.filter(r => r.flagged === true && r.status === "active");

  console.log(`\n${BOLD}── Summary ──${RESET}`);
  console.log(`  Total flagged rows (last 7d): ${allRows.length}`);
  console.log(`  ${GREEN}Visible in Assistant:${RESET} ${visible.length}`);
  if (hidden.length > 0) {
    console.log(`  ${RED}${BOLD}Hidden (would not appear):${RESET} ${hidden.length}`);
    console.log(`\n${RED}${BOLD}FAIL — some flagged alerts are invisible to the Assistant.${RESET}`);
    process.exit(1);
  } else if (allRows.length === 0) {
    console.log(`\n${YELLOW}No flagged rows found — no alerts to verify. Try sending a test emergency.${RESET}`);
    process.exit(0);
  } else {
    console.log(`\n${GREEN}${BOLD}PASS — all flagged alerts are visible in the Assistant.${RESET}`);
    process.exit(0);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
