/**
 * Sends 3 preview emails to hi@adonisblue.io (marked [TEST]) using real Beauty Bar data.
 * Imports the SAME builders the crons use — previews exactly match what clients get.
 * Never sends to any real client.
 *
 * Usage: npm run send-previews
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { Resend } from "resend";
import { buildTreatmentReminderEmail, buildBackupReminderEmail, buildNurseReturnEmail } from "../lib/emails/returnEmails";
import { returnBookingLink } from "../lib/returnLink";

// Load .env.local
readFileSync(".env.local", "utf8").split("\n").forEach((l) => {
  const eq = l.indexOf("=");
  if (eq > 0) {
    const k = l.slice(0, eq).trim();
    const v = l.slice(eq + 1).trim();
    if (k && !process.env[k]) process.env[k] = v;
  }
});

const PREVIEW_TO = "hi@adonisblue.io";
const BEAUTY_BAR_NURSE_ID = "449ee3b6-4bdd-4feb-afb0-1cffe556baf2";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function firstName(name: string | null | undefined, fallback: string): string {
  if (!name?.trim()) return fallback;
  const first = name.trim().split(/\s+/)[0]!;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

async function main() {
  const { data: bot } = await sb
    .from("bots")
    .select("practice_name, booking_link, rebooking_link, slug, alert_email")
    .eq("nurse_id", BEAUTY_BAR_NURSE_ID)
    .single();
  if (!bot) { console.error("Beauty Bar bot not found"); process.exit(1); }

  const practiceName = escapeHtml((bot as any).practice_name || "Beauty Bar");
  const bookingLink = returnBookingLink((bot as any).rebooking_link, (bot as any).booking_link);
  const slug = (bot as any).slug || null;

  const { data: treatment } = await sb
    .from("treatments")
    .select("id,treatment_date,procedure_name,intake_id,procedure_id,intakes(first_name,email),procedures(name,reminder_days)")
    .eq("nurse_id", BEAUTY_BAR_NURSE_ID)
    .eq("id", "0c9e9835-0c75-4b57-ba70-4703c60cdd3c")
    .single();

  if (!treatment) { console.error("Treatment not found"); process.exit(1); }
  const intake: any = Array.isArray(treatment.intakes) ? treatment.intakes[0] : treatment.intakes;
  const clientName = escapeHtml(firstName(intake?.first_name, "Beautiful"));
  const procedureName = escapeHtml((treatment.procedures as any)?.name || treatment.procedure_name);
  const reminderDays: number = (treatment.procedures as any)?.reminder_days || 180;
  const intakeId: string = treatment.intake_id || "preview";

  // ── Email A: client rebooking reminder (treatment-reminders cron) ──
  console.log("Sending (a) client rebooking reminder…");
  const resA = await resend.emails.send({
    from: "AdonisBlue <hi@adonisblue.io>",
    to: PREVIEW_TO,
    subject: `[TEST] Time to refresh your ${procedureName}? ✨ (for ${clientName})`,
    html: buildTreatmentReminderEmail({ clientName, practiceName, bookingLink, procedureName, reminderDays, slug, intakeId }),
  });
  console.log("  →", resA.error ? `ERROR: ${JSON.stringify(resA.error)}` : `sent ${resA.data?.id}`);

  // ── Email B: 6-month backup reminder (reminders cron) ──
  console.log("Sending (b) 6-month backup reminder…");
  const resB = await resend.emails.send({
    from: "AdonisBlue <hi@adonisblue.io>",
    to: PREVIEW_TO,
    subject: `[TEST] ${clientName}, your lips are calling 💋 (6-month backup)`,
    html: buildBackupReminderEmail({ clientName, practiceName, bookingLink, months: 6, intakeId }),
  });
  console.log("  →", resB.error ? `ERROR: ${JSON.stringify(resB.error)}` : `sent ${resB.data?.id}`);

  // ── Email C: Monday nurse "clients coming back" (return-reminder cron) ──
  console.log("Sending (c) Monday nurse 'clients coming back' email…");
  const resC = await resend.emails.send({
    from: "AdonisBlue <hi@adonisblue.io>",
    to: PREVIEW_TO,
    subject: `[TEST] 🔁 1 client due back soon — save them a spot`,
    html: buildNurseReturnEmail({
      practiceName,
      clients: [{ clientName, procedureName, dueFormatted: "April 21" }],
    }),
  });
  console.log("  →", resC.error ? `ERROR: ${JSON.stringify(resC.error)}` : `sent ${resC.data?.id}`);

  console.log("\nDone. Check hi@adonisblue.io inbox.");
}

main().catch((e) => { console.error(e); process.exit(1); });
