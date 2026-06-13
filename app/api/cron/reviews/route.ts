import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";

type BotFields = {
  practice_name: string | null;
  booking_link: string | null;
  instagram: string | null;
  google_review_link: string | null;
} | null;

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

    const now = new Date();
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Find intakes whose aftercare was sent 2-3 days ago and haven't received a review request
    const { data: intakes } = await supabase
      .from("intakes")
      .select("*, bots(practice_name, booking_link, instagram, google_review_link)")
      .not("aftercare_sent_at", "is", null)
      .eq("review_request_sent", false)
      .gte("aftercare_sent_at", threeDaysAgo.toISOString())
      .lte("aftercare_sent_at", twoDaysAgo.toISOString())
      .not("email", "is", null);

    if (!intakes || intakes.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    let sent = 0;

    for (const intake of intakes) {
      const bots = intake.bots as BotFields;
      const clientName = intake.first_name || "Beautiful";
      const practiceName = bots?.practice_name || "your provider";
      const bookingLink = bots?.booking_link || null;
      const googleReviewLink = bots?.google_review_link || null;
      const instagram = bots?.instagram || null;

      try {
        await resend.emails.send({
          from: "AdonisBlue <hello@adonisblue.io>",
          to: intake.email,
          subject: `How are you feeling, ${clientName}? 💙`,
          html: buildReviewEmail({ clientName, practiceName, bookingLink, googleReviewLink, instagram }),
        });

        await supabase
          .from("intakes")
          .update({ review_request_sent: true, review_request_sent_at: new Date().toISOString() })
          .eq("id", intake.id);

        sent++;
      } catch (e) {
        console.error(`Failed to send review request for intake ${intake.id}:`, e);
      }
    }

    return NextResponse.json({ success: true, sent });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function buildReviewEmail({
  clientName,
  practiceName,
  bookingLink,
  googleReviewLink,
  instagram,
}: {
  clientName: string;
  practiceName: string;
  bookingLink: string | null;
  googleReviewLink: string | null;
  instagram: string | null;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>How are you feeling?</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:#1a2744;padding:28px 32px;text-align:center;">
            <img src="${SITE_URL}/Alona.png" alt="AdonisBlue" width="44" height="44" style="border-radius:10px;display:block;margin:0 auto 10px;" />
            <span style="color:#ffffff;font-size:18px;font-weight:600;">${practiceName}</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;">
            <h1 style="margin:0 0 16px;color:#1a2744;font-size:22px;font-weight:600;line-height:1.3;">Hey ${clientName}, how are you feeling? 💕</h1>
            <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">It's been a couple of days since your appointment at ${practiceName} and we just wanted to check in. We hope you're loving your results!</p>
            <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.7;">If you have a moment, we'd love to hear what you thought. Your feedback means the world to us and helps other clients feel confident choosing ${practiceName}.</p>
            ${googleReviewLink ? `
            <div style="text-align:center;margin-bottom:20px;">
              <a href="${googleReviewLink}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:50px;">
                Leave a Google review ⭐
              </a>
            </div>` : ""}
            ${instagram ? `
            <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">You can also tag us on Instagram <strong>@${instagram.replace(/^@/, "")}</strong> — we love seeing your glow! 🌸</p>` : ""}
            ${bookingLink ? `
            <div style="background:#f0fdf4;border-radius:14px;padding:20px;margin:20px 0;text-align:center;">
              <p style="margin:0 0 12px;color:#1a2744;font-size:14px;font-weight:600;">Ready to book your next visit?</p>
              <a href="${bookingLink}" style="display:inline-block;background:#1a2744;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:50px;">Book again 💙</a>
            </div>` : ""}
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
