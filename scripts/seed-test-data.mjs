/**
 * Seeds the TEST nurse account with realistic layout-stress data.
 * Run once: node seed-test-data.mjs
 * Requires .env.local with TEST_NURSE_EMAIL, TEST_NURSE_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dir = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dir, "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const eq = l.indexOf("=");
      return [l.slice(0, eq).trim(), l.slice(eq + 1).trim()];
    })
);

const BASE = "http://localhost:3000";

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function getToken() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: env.TEST_NURSE_EMAIL,
    password: env.TEST_NURSE_PASSWORD,
  });
  if (error || !data.session) throw new Error("Auth failed: " + (error?.message ?? "no session"));
  return data.session.access_token;
}

async function api(token, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { _raw: text }; }
  return { status: res.status, json };
}

// Clients: realistic names including long ones — NO email addresses (prevents any outbound email)
const CLIENTS = [
  { name: "Anastasia Beauchamp-Whitfield", email: "", phone: "312-555-0101" },
  { name: "María José Rodríguez-Hernández", email: "", phone: "773-555-0202" },
  { name: "Samantha Okonkwo-Fitzgerald", email: "", phone: "847-555-0303" },
  { name: "Priya Krishnamurthy-Nair", email: "", phone: "630-555-0404" },
  { name: "Catherine Beaumont-DeLacroix", email: "", phone: "312-555-0505" },
  { name: "Alexandria Vandenbergh", email: "", phone: "708-555-0606" },
  { name: "Gabriella Montoya-Espinosa", email: "", phone: "773-555-0707" },
  { name: "Tiffany Rose", email: "", phone: "312-555-0808" },
  { name: "Veronica Blackwood-Hayes", email: "", phone: "847-555-0909" },
  { name: "Josephine Lecompte", email: "", phone: "630-555-1010" },
  { name: "Xiomara Villanueva-Castillo", email: "", phone: "312-555-1111" },
  { name: "Rebekah Thornton-Ashworth", email: "", phone: "708-555-1212" },
];

// Date helpers
function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log("Signing in as test nurse…");
  const token = await getToken();

  // Get procedures
  console.log("Fetching procedures…");
  const { json: procJson } = await api(token, "GET", "/api/procedures", null);
  const procs = (procJson.procedures ?? []).filter((p) => p.approved_at);
  if (procs.length === 0) {
    console.log("⚠ No approved procedures — treatments will be logged without procedure_ids");
  } else {
    console.log(`Found ${procs.length} approved procedure(s): ${procs.map((p) => p.name).join(", ")}`);
  }

  // Check existing treatment count
  const { json: existingJson } = await api(token, "GET", "/api/treatments", null);
  const existing = existingJson.treatments ?? [];
  console.log(`Existing treatments: ${existing.length}`);

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < CLIENTS.length; i++) {
    const client = CLIENTS[i];
    const daysBack = 3 + i * 5; // spread over past 60 days
    const treatDate = daysAgo(daysBack);

    // Build procedure_ids
    let procedureIds = [];
    if (procs.length > 0) {
      // Treatment #2 gets 2 procedures (stress test for layout)
      procedureIds = i === 1 && procs.length >= 2
        ? [procs[0].id, procs[1].id]
        : [procs[i % procs.length].id];
    }

    // Some treatments get a planned return
    const hasReturnPlan = i < 3;
    const returnPlanPayload = hasReturnPlan ? {
      planned_return_at: daysFromNow(30 + i * 15),
      return_reason: i === 0 ? "Lip filler touch-up — she wants a bit more volume in the upper lip" : i === 1 ? "Botox follow-up" : "Filler review",
      reminder_lead_days: 7,
    } : {};

    // Never send aftercare from seed data — no email addresses anyway
    const sendAftercare = false;

    const body = {
      is_walkin: true,
      walkin_name: client.name,
      walkin_email: client.email,
      walkin_phone: client.phone,
      treatment_date: treatDate,
      procedure_ids: procedureIds,
      procedure_name: procedureIds.length === 0 ? "Lip Filler" : undefined,
      notes: i % 3 === 0 ? "Client has very thin skin, needs careful technique. Watch for bruising near vermillion border." : null,
      send_aftercare: sendAftercare,
      ...returnPlanPayload,
    };

    const { status, json } = await api(token, "POST", "/api/treatments", body);
    if (status === 200 || status === 201) {
      created++;
      console.log(`  ✓ Treatment ${i + 1}: ${client.name} (${treatDate})${hasReturnPlan ? " + return plan" : ""}${!sendAftercare ? " [no aftercare]" : ""}`);
    } else {
      skipped++;
      console.log(`  ✗ Treatment ${i + 1}: ${client.name} → ${status} ${JSON.stringify(json).slice(0, 120)}`);
    }
  }

  // Add an open emergency alert via /api/incidents (if exists) or by inserting via checkin
  // Create a checkin_reminder due today by patching one of the treatments
  // The checkin_reminders are created by a cron, but we can try creating one via a direct call
  // Check if we can create checkin reminders via the API
  console.log("\nChecking for checkin reminders…");
  const { json: checkinJson } = await api(token, "GET", "/api/checkin-reminders", null);
  console.log(`  Reminders found: total=${checkinJson.total}, done=${checkinJson.done}`);
  const pending = (checkinJson.reminders ?? []).filter((r) => r.status !== "done");
  if (pending.length > 0) {
    console.log(`  ✓ ${pending.length} pending reminders, first: ${pending[0].client_name} due ${pending[0].due_date}`);
  } else {
    console.log("  ⚠ No reminders due this week (cron hasn't run; that's expected in dev)");
  }

  console.log(`\nDone. Created: ${created}, Skipped/failed: ${skipped}`);
  console.log("Total treatments after seed:");
  const { json: afterJson } = await api(token, "GET", "/api/treatments", null);
  console.log(`  ${(afterJson.treatments ?? []).length} treatments`);
}

main().catch((e) => { console.error(e); process.exit(1); });
