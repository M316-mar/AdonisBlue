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

function row(label: string, value: string) {
  return `<tr>
    <td style="padding:10px 0 2px;color:#64748b;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">${label}</td>
  </tr>
  <tr>
    <td style="padding:0 0 16px;color:#1a2744;font-size:14px;line-height:1.6;white-space:pre-wrap;">${value}</td>
  </tr>`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const full_name = typeof body.full_name === "string" ? body.full_name.trim() : "";
    const business_name = typeof body.business_name === "string" ? body.business_name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const instagram_handle = typeof body.instagram_handle === "string" ? body.instagram_handle.trim() : null;
    const provider_type = typeof body.provider_type === "string" ? body.provider_type.trim() : "";
    const message_frequency = typeof body.message_frequency === "string" ? body.message_frequency.trim() : "";
    const recent_example = typeof body.recent_example === "string" ? body.recent_example.trim() : "";
    const booking_bottleneck = typeof body.booking_bottleneck === "string" ? body.booking_bottleneck.trim() : "";
    const top_time_takers: string[] = Array.isArray(body.top_time_takers)
      ? body.top_time_takers.filter((v: unknown) => typeof v === "string" && v.trim())
      : [];
    const most_wanted_help = typeof body.most_wanted_help === "string" ? body.most_wanted_help.trim() : "";
    const feedback_willingness = typeof body.feedback_willingness === "string" ? body.feedback_willingness.trim() : "";
    const why_beta = typeof body.why_beta === "string" ? body.why_beta.trim() : "";
    const dream_feature = typeof body.dream_feature === "string" ? body.dream_feature.trim() : null;

    // Required field validation
    const missing: string[] = [];
    if (!full_name) missing.push("full_name");
    if (!business_name) missing.push("business_name");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) missing.push("email");
    if (!provider_type) missing.push("provider_type");
    if (!message_frequency) missing.push("message_frequency");
    if (!recent_example) missing.push("recent_example");
    if (!booking_bottleneck) missing.push("booking_bottleneck");
    if (top_time_takers.length === 0) missing.push("top_time_takers");
    if (!most_wanted_help) missing.push("most_wanted_help");
    if (!feedback_willingness) missing.push("feedback_willingness");
    if (!why_beta) missing.push("why_beta");

    if (missing.length > 0) {
      return NextResponse.json(
        { error: "Missing required fields", fields: missing },
        { status: 400 }
      );
    }

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error: dbError } = await db.from("beta_applications").insert({
      full_name,
      business_name,
      email,
      instagram_handle: instagram_handle || null,
      provider_type,
      message_frequency,
      recent_example,
      booking_bottleneck,
      top_time_takers,
      most_wanted_help,
      feedback_willingness,
      why_beta,
      dream_feature: dream_feature || null,
    });

    if (dbError) {
      console.error("[beta-application] db error:", dbError.message);
      return NextResponse.json({ error: "Failed to save application. Please try again." }, { status: 500 });
    }

    // Fire-and-forget notification email
    resend.emails.send({
      from: "AdonisBlue <hi@adonisblue.io>",
      to: "hi@adonisblue.io",
      subject: `🎉 New Beta Application — ${escapeHtml(business_name)}`,
      html: `
        <div style="font-family:sans-serif;max-width:620px;margin:0 auto;padding:24px;">
          <h2 style="color:#1a2744;margin:0 0 24px;">New Beta Application</h2>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${row("Full Name", escapeHtml(full_name))}
            ${row("Business Name", escapeHtml(business_name))}
            ${row("Email", escapeHtml(email))}
            ${row("Instagram", instagram_handle ? escapeHtml(instagram_handle) : "—")}
            ${row("Provider Type", escapeHtml(provider_type))}
            ${row("Message Frequency", escapeHtml(message_frequency))}
            ${row("Recent Example", escapeHtml(recent_example))}
            ${row("Biggest Booking Bottleneck", escapeHtml(booking_bottleneck))}
            ${row("Top Time Takers", top_time_takers.map(escapeHtml).join(", "))}
            ${row("Most Wanted Help", escapeHtml(most_wanted_help))}
            ${row("Feedback Willingness", escapeHtml(feedback_willingness))}
            ${row("Why Beta", escapeHtml(why_beta))}
            ${row("Dream Feature", dream_feature ? escapeHtml(dream_feature) : "—")}
          </table>
          <p style="margin-top:24px;"><a href="https://www.adonisblue.io/admin" style="background:#1a2744;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">View in Admin →</a></p>
        </div>
      `,
    }).catch((emailError) => {
      console.error("[beta-application] email notification failed:", emailError);
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[beta-application] unexpected error:", e);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
