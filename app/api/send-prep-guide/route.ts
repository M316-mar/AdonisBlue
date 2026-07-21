import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

const DEFAULT_PREP_INSTRUCTIONS = [
  "Come with a clean face — no makeup",
  "Avoid alcohol 24 hours before your appointment",
  "Avoid blood thinners and ibuprofen for 24 hours",
  "Stay hydrated — drink plenty of water",
  "Arrive 10 minutes early",
];

export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { intake_id } = await request.json();
    if (!intake_id) return NextResponse.json({ error: "Missing intake_id" }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch intake — verify it belongs to this nurse
    const { data: intake, error: intakeErr } = await supabase
      .from("intakes")
      .select("id, first_name, email, service_interested, nurse_id")
      .eq("id", intake_id)
      .eq("nurse_id", user.id)
      .single();

    if (intakeErr || !intake) {
      return NextResponse.json({ error: "Intake not found" }, { status: 404 });
    }

    if (!intake.email) {
      return NextResponse.json({ error: "Client has no email address" }, { status: 400 });
    }

    // Fetch nurse's bot for practice name + custom prep instructions
    const { data: bot } = await supabase
      .from("bots")
      .select("practice_name, pre_appointment_instructions")
      .eq("nurse_id", user.id)
      .single();

    const practiceName = bot?.practice_name || "your provider";
    const rawInstructions: string = bot?.pre_appointment_instructions?.trim() || "";

    // Parse instructions — split by newline, fall back to defaults
    const instructionLines: string[] = rawInstructions
      ? rawInstructions.split("\n").map((l: string) => l.trim()).filter(Boolean)
      : DEFAULT_PREP_INSTRUCTIONS;

    const checklistHtml = instructionLines
      .map(
        (line) =>
          `<tr><td style="padding:6px 0;color:#1a2744;font-size:15px;">✅ ${line}</td></tr>`
      )
      .join("");

    const clientName = intake.first_name || "there";
    const serviceText = intake.service_interested ? ` for your ${intake.service_interested}` : "";

    await resend.emails.send({
      from: "AdonisBlue <hello@adonisblue.io>",
      to: intake.email,
      subject: `See you soon, ${clientName}! Here's how to prepare 💙`,
      html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.07);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1a2744 0%,#0d3d38 100%);padding:32px;text-align:center;">
          <p style="margin:0;color:#ffffff;font-size:26px;font-weight:700;">Your Appointment is Coming Up! 💙</p>
          <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:15px;">${practiceName}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;color:#1a2744;font-size:17px;font-weight:600;">Hi ${clientName}! 👋</p>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">
            We're so excited to see you${serviceText}! To make sure you get the best results and most comfortable experience, here's how to prepare:
          </p>

          <!-- Checklist -->
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

        <!-- Footer -->
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
      .update({
        prep_guide_sent: true,
        prep_guide_sent_at: new Date().toISOString(),
      })
      .eq("id", intake_id)
      .eq("nurse_id", user.id);

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[send-prep-guide] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
