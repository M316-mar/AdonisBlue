import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const rawIds: unknown = body.treatment_ids;

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json({ error: "No treatment IDs provided" }, { status: 400 });
    }

    const treatmentIds = rawIds.filter(
      (id): id is string => typeof id === "string" && UUID_REGEX.test(id)
    );

    if (treatmentIds.length === 0) {
      return NextResponse.json({ error: "No valid treatment IDs" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch treatments — enforce nurse_id ownership
    const { data: treatments } = await supabase
      .from("treatments")
      .select("id, procedure_name, treatment_date, intake_id, intakes(first_name, email)")
      .in("id", treatmentIds)
      .eq("nurse_id", user.id);

    if (!treatments || treatments.length === 0) {
      return NextResponse.json({ error: "No matching treatments found" }, { status: 404 });
    }

    const { data: bot } = await supabase
      .from("bots")
      .select("practice_name, booking_link")
      .eq("nurse_id", user.id)
      .single();

    const practiceName = escapeHtml(bot?.practice_name || "your provider");
    const bookingLink = bot?.booking_link || null;

    let sent = 0;

    for (const treatment of treatments) {
      const intake = treatment.intakes as { first_name?: string; email?: string } | null;
      const clientEmail = intake?.email;
      const clientName = escapeHtml(intake?.first_name || "Beautiful");
      const procedureName = escapeHtml(treatment.procedure_name || "your procedure");

      const daysSince = treatment.treatment_date
        ? Math.floor(
            (Date.now() - new Date(treatment.treatment_date).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null;

      const timeNote =
        daysSince !== null && daysSince > 0
          ? `It's been ${daysSince} day${daysSince !== 1 ? "s" : ""} since your ${procedureName}`
          : `Since your recent ${procedureName}`;

      if (!clientEmail) continue;

      try {
        await resend.emails.send({
          from: "AdonisBlue <hello@adonisblue.io>",
          to: clientEmail,
          subject: `${clientName}, time to glow again? ✨`,
          html: `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Time to rebook</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#1a2744;padding:28px 32px;text-align:center;">
          <img src="${SITE_URL}/Alona.png" alt="AdonisBlue" width="44" height="44" style="border-radius:10px;display:block;margin:0 auto 10px;" />
          <span style="color:#fff;font-size:18px;font-weight:600;">${practiceName}</span>
        </td></tr>
        <tr><td style="padding:36px 32px;">
          <h1 style="margin:0 0 12px;color:#1a2744;font-size:22px;font-weight:600;">Hey ${clientName}! 💙</h1>
          <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">${timeNote} at ${practiceName} — and we just wanted to check in and say we miss you! 🌸</p>
          <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.7;">Your results are looking amazing, and this is the perfect time to maintain or enhance them before they fade. Coming back now means less work and better results.</p>
          ${bookingLink ? `
          <div style="text-align:center;margin:0 0 24px;">
            <a href="${bookingLink}" style="display:inline-block;background:#0d9488;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:50px;">Book my next appointment 💕</a>
          </div>` : ""}
          <div style="background:#f0fdf4;border-radius:14px;padding:20px;margin:0 0 16px;text-align:center;">
            <p style="margin:0 0 8px;color:#1a2744;font-size:14px;font-weight:600;">Still have recovery questions? 💬</p>
            <p style="margin:0 0 12px;color:#475569;font-size:13px;">Your 24/7 recovery assistant is still here for you.</p>
            <a href="${SITE_URL}/healing/${treatment.id}" style="display:inline-block;background:#1a2744;color:#fff;font-size:13px;font-weight:600;text-decoration:none;padding:10px 24px;border-radius:50px;">Open recovery chat</a>
          </div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">Sent with care by ${practiceName} via AdonisBlue</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
        });
        sent++;
        // Mark followup sent on the intake
        if (treatment.intake_id) {
          await supabase
            .from("intakes")
            .update({ followup_sent: true, followup_sent_at: new Date().toISOString() })
            .eq("id", treatment.intake_id);
        }
      } catch {
        // continue — don't fail the whole batch for one bad email
      }
    }

    return NextResponse.json({ success: true, sent });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
