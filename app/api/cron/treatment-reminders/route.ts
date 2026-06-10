import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all treatments with procedures that have reminder_days set
    const { data: treatments } = await supabase
      .from("treatments")
      .select("*, intakes(first_name, email), procedures(name, reminder_days), bots:nurse_id(practice_name, booking_link)")
      .eq("reminder_sent", false)
      .not("procedure_id", "is", null);

    if (!treatments || treatments.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    let sentCount = 0;
    const today = new Date();

    for (const treatment of treatments) {
      const reminderDays = (treatment.procedures as any)?.reminder_days;
      if (!reminderDays) continue;

      const treatmentDate = new Date(treatment.treatment_date);
      const reminderDate = new Date(treatmentDate.getTime() + reminderDays * 24 * 60 * 60 * 1000);
      const diffDays = Math.floor((today.getTime() - reminderDate.getTime()) / (1000 * 60 * 60 * 24));

      // Send if reminder date is today (within 1 day window)
      if (diffDays < 0 || diffDays > 1) continue;

      const clientEmail = treatment.intakes?.email;
      const clientName = treatment.intakes?.first_name || "Beautiful";
      const practiceName = (treatment.bots as any)?.practice_name || "your provider";
      const bookingLink = (treatment.bots as any)?.booking_link || SITE_URL;
      const procedureName = (treatment.procedures as any)?.name || treatment.procedure_name || "your treatment";

      if (!clientEmail) continue;

      try {
        await resend.emails.send({
          from: "AdonisBlue <hello@adonisblue.io>",
          to: clientEmail,
          subject: `Time to refresh your ${procedureName}? ✨`,
          html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#1a2744;padding:28px 32px;text-align:center;">
          <img src="${SITE_URL}/Alona.png" alt="AdonisBlue" width="44" height="44" style="border-radius:10px;display:block;margin:0 auto 10px;" />
          <span style="color:#fff;font-size:18px;font-weight:600;">${practiceName}</span>
        </td></tr>
        <tr><td style="padding:36px 32px;">
          <h1 style="margin:0 0 8px;color:#1a2744;font-size:22px;font-weight:600;">Hey ${clientName}, time for a refresh? 💙</h1>
          <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">It's been ${reminderDays} days since your <strong>${procedureName}</strong> — which means it's the perfect time to book your next appointment and keep looking and feeling your best!</p>
          <div style="background:#f0fdf4;border-radius:14px;padding:20px;margin:20px 0;text-align:center;">
            <p style="margin:0 0 12px;color:#1a2744;font-size:15px;font-weight:600;">Ready to refresh your look? ✨</p>
            <a href="${bookingLink}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:50px;">Book my appointment 💙</a>
          </div>
          <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;">We can't wait to see you again! 💕</p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">Sent with care by ${practiceName} via AdonisBlue</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
        });

        await supabase
          .from("treatments")
          .update({ reminder_sent: true, reminder_sent_at: new Date().toISOString() })
          .eq("id", treatment.id);

        sentCount++;
      } catch (e) {
        console.error(`Failed to send reminder for treatment ${treatment.id}:`, e);
      }
    }

    return NextResponse.json({ sent: sentCount });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
