import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { sendEmail } from "@/lib/sendAndLog";
import { getClientSender } from "@/lib/clientEmailSender";

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
    const { intake_id } = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: intake } = await supabase
      .from("intakes")
      .select("*, review_token")
      .eq("id", intake_id)
      .single();

    if (!intake) return NextResponse.json({ error: "Intake not found" }, { status: 404 });
    if (intake.marketing_opt_out) return NextResponse.json({ skipped: true });

    // Reuse existing review_token or generate one
    let reviewToken: string = intake.review_token;
    if (!reviewToken) {
      reviewToken = crypto.randomBytes(32).toString("base64url");
      await supabase.from("intakes").update({ review_token: reviewToken }).eq("id", intake_id);
    }

    // Fetch bot fields
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("aftercare, practice_name, primary_color, google_review_link, alert_email, alert_email_verified, notification_email")
      .eq("nurse_id", intake.nurse_id)
      .single();
    if (botError) console.error("[send-survey] bot fetch error:", JSON.stringify(botError));

    const aftercare = bot?.aftercare ? escapeHtml(bot.aftercare) : null;
    const practiceName = escapeHtml(bot?.practice_name || "your provider");

    const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.adonisblue.io";
    // If the nurse has a Google review link, send clients there directly
    const googleReviewLink = (bot?.google_review_link as string | null | undefined) ?? null;
    const surveyUrl = googleReviewLink || `${SITE_URL}/review/${reviewToken}`;

    await sendEmail({
      type: "review_request",
      nurse_id: intake.nurse_id,
      intake_id: intake.id,
      to: intake.email,
      subject: `Thank you for your visit! 💙 Your aftercare + a quick favor`,
      ...getClientSender(bot ?? {}),
      html: `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #1a2744;">Thank you for visiting ${practiceName}! 🌸</h2>
      <p style="color: #475569;">We hope you're loving your results! Here's everything you need to take care of yourself after your appointment.</p>

      ${aftercare ? `
      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0; border-left: 4px solid #0d9488;">
        <h3 style="color: #0d9488; margin-top: 0;">📋 Your Aftercare Instructions</h3>
        <p style="color: #1a2744; white-space: pre-wrap; line-height: 1.7;">${aftercare}</p>
      </div>
      ` : ""}

      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0;">
        <h3 style="color: #1a2744; margin-top: 0;">How did everything go? 💕</h3>
        <p style="color: #475569;">We'd love to hear about your experience — it only takes 30 seconds!</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${surveyUrl}" style="background: #0d9488; color: white; padding: 14px 28px; border-radius: 50px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Rate my experience ⭐
          </a>
        </div>
      </div>

      <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
        Sent with care by AdonisBlue 💙 — helping nurses take care of their clients, even after they leave.
      </p>
      <p style="color: #cbd5e1; font-size: 11px;">
        <a href="https://www.adonisblue.io/api/unsubscribe?id=${intake_id}" style="color: #cbd5e1; text-decoration: underline;">Unsubscribe from these emails</a>
      </p>
    </div>
  `,
      supabase,
    });

    await supabase
      .from("intakes")
      .update({ survey_sent: true })
      .eq("id", intake_id);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
