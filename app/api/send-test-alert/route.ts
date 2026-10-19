import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/sendAndLog";
import { logError } from "@/lib/logError";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.adonisblue.io";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await supabaseAuth.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: bot, error: botErr } = await db
    .from("bots")
    .select("alert_email, practice_name")
    .eq("nurse_id", user.id)
    .maybeSingle();

  if (botErr) {
    await logError("send-test-alert", botErr.message, user.id);
    return NextResponse.json({ error: "Could not load your account." }, { status: 500 });
  }

  const alertEmail = (bot as { alert_email?: string | null } | null)?.alert_email?.trim();
  if (!alertEmail) return NextResponse.json({ error: "No alert email set." }, { status: 400 });

  const verifyToken = crypto.randomUUID();
  const { error: tokenErr } = await db
    .from("bots")
    .update({ alert_verification_token: verifyToken })
    .eq("nurse_id", user.id);

  if (tokenErr) {
    await logError("send-test-alert", tokenErr.message, user.id);
    return NextResponse.json({ error: "Could not prepare verification." }, { status: 500 });
  }

  const verifyUrl = `${SITE_URL}/api/verify-alert?token=${encodeURIComponent(verifyToken)}&nurse_id=${encodeURIComponent(user.id)}`;
  const practiceName = (bot as { practice_name?: string | null } | null)?.practice_name ?? "your practice";

  const result = await sendEmail({
    type: "alert_verification",
    nurse_id: user.id,
    to: alertEmail,
    subject: "✅ Confirm your emergency alert email — AdonisBlue",
    html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#1a2744;padding:24px 32px;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">🚨 Test emergency alert</p>
          <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">${escapeHtml(practiceName)}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 12px;font-size:15px;color:#1a2744;font-weight:600;">This is a test — your bot is working.</p>
          <p style="margin:0 0 20px;font-size:15px;color:#475569;">When a client describes a medical emergency in your chat, you&rsquo;ll get an email like this one. Click below to confirm this is the right address:</p>
          <p style="margin:0 0 24px;">
            <a href="${verifyUrl}" style="display:inline-block;background:#0d9488;color:#fff;padding:14px 32px;border-radius:999px;text-decoration:none;font-weight:700;font-size:15px;">✅ Yes, I got it</a>
          </p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
          <p style="margin:0;font-size:13px;color:#94a3b8;">This link works once. If you didn&rsquo;t expect this email, you can ignore it safely.</p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">AdonisBlue &middot; hi@adonisblue.io</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
    supabase: db,
  });

  if (!result.ok) {
    await logError("send-test-alert", result.error ?? "send failed", user.id);
    return NextResponse.json({ error: "Could not send the test email. Please check the address and try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
