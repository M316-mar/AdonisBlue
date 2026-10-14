import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { sendEmail } from "@/lib/sendAndLog";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

type BotFields = {
  practice_name: string | null;
  booking_link: string | null;
  instagram: string | null;
  google_review_link: string | null;
  facebook_review_link: string | null;
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
    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // 14-30 days after aftercare sent; skip anyone already asked or who already submitted
    const { data: intakes, error: intakesError } = await supabase
      .from("intakes")
      .select("*, bots(practice_name, booking_link, instagram, google_review_link, facebook_review_link)")
      .not("aftercare_sent_at", "is", null)
      .eq("review_request_sent", false)
      .eq("survey_sent", false)
      .is("review_submitted_at", null)
      .eq("marketing_opt_out", false)
      .gte("aftercare_sent_at", thirtyDaysAgo.toISOString())
      .lte("aftercare_sent_at", fourteenDaysAgo.toISOString())
      .not("email", "is", null);

    if (intakesError) {
      console.error("[cron/reviews] Supabase query error:", JSON.stringify(intakesError));
      return NextResponse.json({ error: String(intakesError.message) }, { status: 500 });
    }

    if (!intakes || intakes.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    let sent = 0;

    for (const intake of intakes) {
      const bots = intake.bots as BotFields;
      const clientName = escapeHtml(intake.first_name || "Beautiful");
      const practiceName = escapeHtml(bots?.practice_name || "your provider");
      const bookingLink = bots?.booking_link || null;
      const instagram = bots?.instagram || null;

      // Reuse existing token or generate a new one
      let reviewToken: string = intake.review_token;
      if (!reviewToken) {
        reviewToken = crypto.randomBytes(32).toString("base64url");
        const { error: tokenErr } = await supabase
          .from("intakes")
          .update({ review_token: reviewToken })
          .eq("id", intake.id);
        if (tokenErr) {
          console.error(`Failed to save review_token for intake ${intake.id}:`, tokenErr);
          continue;
        }
      }

      const googleReviewLink = bots?.google_review_link || null;
      // If nurse has a Google review link, send clients there directly.
      // We can't detect Google submissions, so review_request_sent stays as the state.
      const mainReviewUrl = googleReviewLink || `${SITE_URL}/review/${reviewToken}`;

      const result = await sendEmail({
        type: "review_request",
        nurse_id: intake.nurse_id,
        intake_id: intake.id,
        to: intake.email,
        subject: `How are you feeling, ${clientName}? 💙`,
        html: buildReviewEmail({ clientName, practiceName, bookingLink, instagram, intakeId: intake.id, reviewUrl: mainReviewUrl }),
        supabase,
      });

      if (result.ok) {
        await supabase
          .from("intakes")
          .update({ review_request_sent: true, review_request_sent_at: new Date().toISOString() })
          .eq("id", intake.id);
        sent++;
      }
    }

    // Heartbeat
    await supabase.from("message_log").insert({
      type: "cron:reviews",
      channel: "email",
      status: "sent",
      error: `sent ${sent}, failed 0`,
    });

    return NextResponse.json({ success: true, sent });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

function buildReviewEmail({
  clientName,
  practiceName,
  bookingLink,
  instagram,
  intakeId,
  reviewUrl,
}: {
  clientName: string;
  practiceName: string;
  bookingLink: string | null;
  instagram: string | null;
  intakeId: string;
  reviewUrl: string;
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
            <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">It's been a couple of weeks since your appointment at ${practiceName} and we just wanted to check in. We hope you're loving your results!</p>
            <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.7;">If you have a moment, we'd love to hear what you thought. Your feedback means the world to us and helps other clients feel confident choosing ${practiceName}.</p>
            <div style="text-align:center;margin-bottom:20px;">
              <a href="${reviewUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:50px;">
                Share your experience ⭐
              </a>
            </div>
            ${instagram ? `
            <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">You can also tag us on Instagram <strong>@${escapeHtml(instagram.replace(/^@/, ""))}</strong> — we love seeing your glow! 🌸</p>` : ""}
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
            <p style="margin:0 0 6px;color:#cbd5e1;font-size:11px;">You're receiving this because you visited ${practiceName}.</p>
            <p style="margin:0;color:#cbd5e1;font-size:11px;"><a href="${SITE_URL}/api/unsubscribe?id=${intakeId}" style="color:#cbd5e1;text-decoration:underline;">Unsubscribe from these emails</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
