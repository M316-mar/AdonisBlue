import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const DEFAULT_PREP_INSTRUCTIONS = [
  "Please arrive with a clean face — no makeup, moisturiser, or SPF.",
  "Avoid alcohol for 24 hours before your appointment.",
  "Avoid blood thinners, aspirin, and ibuprofen for 24 hours.",
  "Stay hydrated — drink plenty of water in the days leading up.",
  "Arrive 5–10 minutes early so we can get started on time.",
];

export async function GET(request: Request) {
  // Verify this is called by Vercel cron
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find treatments with a date 24–48 hours from now
  const now = new Date();
  const windowStart = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24h
  const windowEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);   // +48h

  // Get the date range (date-only comparison)
  const startDate = windowStart.toISOString().split("T")[0];
  const endDate = windowEnd.toISOString().split("T")[0];

  // Find treatments in the window where the intake hasn't had prep guide sent yet
  const { data: treatments, error } = await supabase
    .from("treatments")
    .select(`
      id,
      procedure_name,
      treatment_date,
      intake_id,
      intakes (
        id,
        first_name,
        email,
        nurse_id,
        prep_guide_sent
      )
    `)
    .gte("treatment_date", startDate)
    .lte("treatment_date", endDate)
    .not("intake_id", "is", null)
    .eq("archived", false);

  if (error) {
    console.error("[prep-reminders] query error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { intake_id: string; status: string }[] = [];

  for (const treatment of treatments ?? []) {
    const intake = Array.isArray(treatment.intakes) ? treatment.intakes[0] : treatment.intakes;
    if (!intake) continue;
    if (!intake.email) continue;
    if (intake.prep_guide_sent) continue; // already sent

    // Fetch nurse's bot for practice name + custom prep instructions
    const { data: bot } = await supabase
      .from("bots")
      .select("practice_name, pre_appointment_instructions")
      .eq("nurse_id", intake.nurse_id)
      .single();

    const practiceName = escapeHtml(bot?.practice_name || "your provider");
    const rawInstructions: string = bot?.pre_appointment_instructions?.trim() || "";
    const instructionLines: string[] = rawInstructions
      ? rawInstructions.split("\n").map((l: string) => l.trim()).filter(Boolean)
      : DEFAULT_PREP_INSTRUCTIONS;

    const checklistHtml = instructionLines
      .map(line => `<tr><td style="padding:6px 0;color:#1a2744;font-size:15px;">✅ ${line}</td></tr>`)
      .join("");

    const clientName = escapeHtml(intake.first_name || "there");
    const apptDate = new Date(treatment.treatment_date).toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric",
    });

    try {
      await resend.emails.send({
        from: "AdonisBlue <hi@adonisblue.io>",
        to: intake.email,
        subject: `See you soon, ${clientName}! Here's how to prepare 💙`,
        html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">
        <tr><td style="background:linear-gradient(135deg,#1a2744 0%,#0d3d38 100%);padding:32px;text-align:center;">
          <p style="margin:0;color:#ffffff;font-size:26px;font-weight:700;">Your Appointment is Coming Up! 💙</p>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:15px;">${practiceName} · ${apptDate}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;color:#1a2744;font-size:17px;font-weight:600;">Hi ${clientName}! 👋</p>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            We're so excited to see you for your ${escapeHtml(treatment.procedure_name || "")}! To make sure you get the best results and most comfortable experience, here's how to prepare:
          </p>
          <div style="background:#f0fdf4;border-radius:14px;border:1px solid #bbf7d0;padding:20px 24px;margin-bottom:24px;">
            <p style="margin:0 0 12px;color:#0d9488;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Pre-Appointment Checklist</p>
            <table width="100%" cellpadding="0" cellspacing="0">
              ${checklistHtml}
            </table>
          </div>
          <p style="margin:0 0 8px;color:#475569;font-size:14px;line-height:1.6;">
            If you have any questions before your appointment, don't hesitate to reach out. We're here for you! 💕
          </p>
          <div style="text-align:center;margin:28px 0 8px;">
            <p style="margin:0;color:#1a2744;font-size:16px;font-weight:700;">We can't wait to see you! 🦋</p>
            <p style="margin:4px 0 0;color:#0d9488;font-size:14px;">${practiceName}</p>
          </div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">Sent with love by AdonisBlue 💙</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
      });

      // Mark as sent
      await supabase
        .from("intakes")
        .update({ prep_guide_sent: true, prep_guide_sent_at: new Date().toISOString() })
        .eq("id", intake.id);

      results.push({ intake_id: intake.id, status: "sent" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[prep-reminders] failed for intake ${intake.id}:`, msg);
      results.push({ intake_id: intake.id, status: `error: ${msg}` });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
