import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { intake_id } = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: intake } = await supabase
      .from("intakes")
      .select("*")
      .eq("id", intake_id)
      .single();

    if (!intake) return NextResponse.json({ error: "Intake not found" }, { status: 404 });

    const { data: bot } = await supabase
      .from("bots")
      .select("aftercare, aftercare_template, practice_name, primary_color, logo_image, logo_data_url")
      .eq("nurse_id", intake.nurse_id)
      .single();

    const aftercare = bot?.aftercare_template || bot?.aftercare || "Take care of yourself and stay hydrated!";
    const practiceName = bot?.practice_name || "your provider";
    const clientName = intake.first_name || "Beautiful";

    if (intake.email) {
      await resend.emails.send({
        from: "AdonisBlue <hello@adonisblue.io>",
        to: intake.email,
        subject: `Your aftercare instructions from ${practiceName} 💙`,
        html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Your Aftercare Instructions</title></head>
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
            <h1 style="margin:0 0 8px;color:#1a2744;font-size:22px;font-weight:600;">You're glowing, ${clientName}! 🌸</h1>
            <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.65;">Thank you so much for trusting us with your beauty. Here are your aftercare instructions to keep your results looking their absolute best.</p>
            <div style="background:#f0fdf4;border-radius:14px;padding:24px;margin:0 0 24px;border-left:4px solid #0d9488;">
              <h2 style="margin:0 0 12px;color:#0d9488;font-size:16px;font-weight:600;">📋 Your Aftercare Instructions</h2>
              <p style="margin:0;color:#1a2744;font-size:15px;line-height:1.75;white-space:pre-wrap;">${aftercare}</p>
            </div>
            <p style="margin:0 0 8px;color:#475569;font-size:14px;line-height:1.65;">Questions? Reply to this email or reach out through your booking link anytime.</p>
            <p style="margin:0;color:#475569;font-size:14px;line-height:1.65;">We can't wait to see you again! 💕</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">Sent with care by ${practiceName} via AdonisBlue · hello@adonisblue.io</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      });
    }

    await supabase
      .from("intakes")
      .update({ aftercare_sent: true, aftercare_sent_at: new Date().toISOString() })
      .eq("id", intake_id);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
