import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

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

  const now = new Date();
  const sixMonthsAgo = new Date(now);
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const nineMonthsAgo = new Date(now);
  nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9);

  // Find intakes due for 6 month reminder
  const { data: sixMonthDue } = await supabase
    .from("intakes")
    .select("*, bots(practice_name, booking_link, primary_color)")
    .not("aftercare_sent_at", "is", null)
    .eq("reminder_6m_sent", false)
    .lte("aftercare_sent_at", sixMonthsAgo.toISOString())
    .not("email", "is", null);

  // Find intakes due for 9 month reminder
  const { data: nineMonthDue } = await supabase
    .from("intakes")
    .select("*, bots(practice_name, booking_link, primary_color)")
    .not("aftercare_sent_at", "is", null)
    .eq("reminder_9m_sent", false)
    .lte("aftercare_sent_at", nineMonthsAgo.toISOString())
    .not("email", "is", null);

  let sent = 0;

  // Send 6 month reminders
  for (const intake of sixMonthDue ?? []) {
    const practiceName = intake.bots?.practice_name || "your provider";
    const bookingLink = intake.bots?.booking_link || null;
    const clientName = intake.first_name || "Beautiful";

    try {
      await resend.emails.send({
        from: "AdonisBlue <hello@adonisblue.io>",
        to: intake.email,
        subject: `${clientName}, your lips are calling 💋`,
        html: buildReminderEmail({ clientName, practiceName, bookingLink, months: 6 }),
      });
      await supabase.from("intakes").update({ reminder_6m_sent: true }).eq("id", intake.id);
      sent++;
    } catch (e) {
      console.error("6m reminder error:", e);
    }
  }

  // Send 9 month reminders
  for (const intake of nineMonthDue ?? []) {
    const practiceName = intake.bots?.practice_name || "your provider";
    const bookingLink = intake.bots?.booking_link || null;
    const clientName = intake.first_name || "Beautiful";

    try {
      await resend.emails.send({
        from: "AdonisBlue <hello@adonisblue.io>",
        to: intake.email,
        subject: `It's been a while, ${clientName} — time to glow again ✨`,
        html: buildReminderEmail({ clientName, practiceName, bookingLink, months: 9 }),
      });
      await supabase.from("intakes").update({ reminder_9m_sent: true }).eq("id", intake.id);
      sent++;
    } catch (e) {
      console.error("9m reminder error:", e);
    }
  }

  return NextResponse.json({ success: true, sent });
}

function buildReminderEmail({ clientName, practiceName, bookingLink, months }: {
  clientName: string;
  practiceName: string;
  bookingLink: string | null;
  months: number;
}) {
  const is6 = months === 6;
  const headline = is6
    ? `Your results are fading, ${clientName} — and we miss you 💕`
    : `${clientName}, it's been 9 months. Your glow is ready for a refresh ✨`;
  const body1 = is6
    ? `It's been about 6 months since your last appointment at ${practiceName} — which means your filler is naturally starting to soften. This is actually the perfect time to come back for a touch up before it fully fades.`
    : `Nine months in, and your results have done their job beautifully. But the best version of your look? It's one appointment away. Coming back now means your nurse can build on what's already there — not start from scratch.`;
  const body2 = is6
    ? `Most clients say their 6-month touch up is their favorite appointment — it's subtle, quick, and keeps you looking effortlessly fresh. No one will know. They'll just think you look amazing.`
    : `Your lips, cheeks, or wherever you last treated — they're ready. And so are we. Don't let the work fade completely. A small refresh now goes a long way.`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Time to glow again</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:#1a2744;padding:28px 32px;text-align:center;">
            <img src="https://adonisblue.io/Alona.png" alt="AdonisBlue" width="44" height="44" style="border-radius:10px;display:block;margin:0 auto 10px;" />
            <span style="color:#ffffff;font-size:18px;font-weight:600;">${practiceName}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;">
            <h1 style="margin:0 0 16px;color:#1a2744;font-size:22px;font-weight:600;line-height:1.3;">${headline}</h1>
            <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">${body1}</p>
            <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.7;">${body2}</p>
            ${bookingLink ? `
            <a href="${bookingLink}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:50px;">
              Book my touch up 💕
            </a>` : `<p style="color:#0d9488;font-size:15px;font-weight:600;">Contact ${practiceName} to book your appointment 💕</p>`}
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;">Sent with care by ${practiceName} via AdonisBlue</p>
            <p style="margin:0;color:#cbd5e1;font-size:11px;">You're receiving this because you visited ${practiceName}.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
