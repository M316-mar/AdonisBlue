import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { checkForEmergency } from "@/lib/emergencyCheck";

const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      token?: string;
      rating?: unknown;
      review_text?: unknown;
      ok_to_share?: unknown;
      display_name?: unknown;
    };

    const { token, rating, review_text, ok_to_share, display_name } = body;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }
    const ratingNum = Number(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json({ error: "Rating must be 1–5" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Look up intake by token
    const { data: intake } = await supabase
      .from("intakes")
      .select("id, nurse_id, first_name, email, phone, service_interested, review_submitted_at")
      .eq("review_token", token)
      .single();

    if (!intake) {
      return NextResponse.json({ error: "Invalid or expired review link" }, { status: 404 });
    }
    if (intake.review_submitted_at) {
      return NextResponse.json({ error: "Review already submitted" }, { status: 409 });
    }

    const reviewText = typeof review_text === "string" ? review_text.trim().slice(0, 2000) : null;
    const oKToShare = ok_to_share === true;
    const displayNameRaw = typeof display_name === "string" ? display_name.trim().slice(0, 100) : null;

    // Run emergency check on review text (server-side, never trusting client flag)
    let isFlagged = false;
    let flaggedMessage: string | null = null;
    if (reviewText) {
      const check = await checkForEmergency(reviewText, intake.nurse_id);
      isFlagged = check.flagged;
      if (isFlagged) {
        flaggedMessage = reviewText.slice(0, 500);
      }
    }

    // Insert review — server sets nurse_id, never client
    const { error: reviewError } = await supabase.from("reviews").insert({
      intake_id: intake.id,
      nurse_id: intake.nurse_id,
      rating: ratingNum,
      review_text: reviewText,
      ok_to_share: oKToShare,
      display_name: displayNameRaw,
      flagged: isFlagged,
      flagged_message: flaggedMessage,
    });

    if (reviewError) {
      console.error("Failed to insert review:", reviewError);
      return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
    }

    // Mark intake as submitted
    await supabase
      .from("intakes")
      .update({ review_submitted_at: new Date().toISOString() })
      .eq("id", intake.id);

    // Fetch nurse alert email + bot details for notifications
    const { data: botRow } = await supabase
      .from("bots")
      .select("practice_name, notification_email, google_review_link, facebook_review_link")
      .eq("nurse_id", intake.nurse_id)
      .single();

    const practiceName = escapeHtml((botRow as { practice_name?: string } | null)?.practice_name || "your practice");
    const googleReviewLink = (botRow as { google_review_link?: string } | null)?.google_review_link || null;
    const facebookReviewLink = (botRow as { facebook_review_link?: string } | null)?.facebook_review_link || null;

    let nurseAlertEmail = (botRow as { notification_email?: string } | null)?.notification_email?.trim() || null;
    if (!nurseAlertEmail) {
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(intake.nurse_id);
        nurseAlertEmail = authUser?.user?.email ?? null;
      } catch (err) {
        console.error("[review] Failed to fetch fallback nurse email:", err);
      }
    }

    if (isFlagged && !nurseAlertEmail) {
      console.error(`[review] EMERGENCY flagged for intake ${intake.id} but no alert email found for nurse ${intake.nurse_id} — alert could not be sent`);
    }

    // If emergency flagged: alert nurse
    if (isFlagged && nurseAlertEmail) {
      const clientName = escapeHtml(intake.first_name || "A client");
      const safeMessage = escapeHtml(flaggedMessage || "");
      resend.emails.send({
        from: "AdonisBlue <hi@adonisblue.io>",
        to: nurseAlertEmail,
        subject: `⚠️ URGENT: ${clientName} may need attention — review flagged`,
        html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#fef2f2;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:2px solid #ef4444;">
        <tr><td style="background:#ef4444;padding:24px 32px;text-align:center;">
          <span style="color:#fff;font-size:24px;">⚠️</span>
          <p style="margin:8px 0 0;color:#fff;font-size:18px;font-weight:700;">URGENT — Client review flagged</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#1a2744;font-size:16px;"><strong>${clientName}</strong> submitted a review that contains a concerning phrase:</p>
          <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0;color:#dc2626;font-size:15px;font-weight:600;">&ldquo;${safeMessage}&rdquo;</p>
          </div>
          <p style="margin:16px 0;color:#475569;font-size:14px;">Contact details:</p>
          <p style="margin:4px 0;color:#1a2744;font-size:14px;">📧 ${escapeHtml(intake.email || "No email")}</p>
          <p style="margin:4px 0;color:#1a2744;font-size:14px;">📱 ${escapeHtml(intake.phone || "Not provided")}</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#ef4444;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:50px;">View in dashboard</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
      }).catch((e) => console.error("[review] Failed to send emergency alert:", e));
    }

    // Send nurse a notification for the new review (non-emergency)
    if (!isFlagged && nurseAlertEmail) {
      const clientName = escapeHtml(intake.first_name || "A client");
      const stars = "⭐".repeat(ratingNum) + "☆".repeat(5 - ratingNum);
      resend.emails.send({
        from: "AdonisBlue <hi@adonisblue.io>",
        to: nurseAlertEmail,
        subject: `⭐ New review — ${ratingNum}/5 stars`,
        html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#1a2744;padding:24px 32px;text-align:center;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">New client review 💙</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="font-size:28px;margin:0 0 8px;">${stars}</p>
          <p style="margin:0 0 16px;color:#1a2744;font-size:16px;font-weight:600;">${ratingNum}/5 stars from ${clientName}</p>
          ${reviewText ? `<div style="background:#f8fafc;border-radius:12px;padding:16px;margin:16px 0;"><p style="margin:0;color:#475569;font-size:15px;font-style:italic;">&ldquo;${escapeHtml(reviewText)}&rdquo;</p></div>` : ""}
          <div style="text-align:center;margin:24px 0;">
            <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#0d9488;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:50px;">View in dashboard</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
      }).catch((e) => console.error("[review] Failed to send nurse notification:", e));
    }

    return NextResponse.json({
      success: true,
      emergency: isFlagged,
      googleReviewLink,
      facebookReviewLink,
    });
  } catch (e) {
    console.error("Review submit error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
