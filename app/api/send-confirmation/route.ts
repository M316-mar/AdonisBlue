import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const { user, email_data } = payload;

    const toEmail = user?.email;
    if (!toEmail) {
      return NextResponse.json({ error: "No email in payload" }, { status: 400 });
    }

    const actionType = email_data?.email_action_type ?? "signup";
    const firstName = user?.user_metadata?.full_name?.trim().split(" ")[0] ?? "there";
    const tokenHash = email_data?.token_hash ?? email_data?.token ?? "";

    let subject: string;
    let html: string;

    if (actionType === "recovery") {
      const resetUrl = `${SITE_URL}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=recovery`;
      subject = "Reset your AdonisBlue password";
      html = buildEmail({
        title: "Reset your password",
        body: `Hi ${firstName}! Click below to reset your password. This link expires in 1 hour.`,
        ctaLabel: "Reset my password",
        ctaUrl: resetUrl,
        footer: "If you didn't request this, you can safely ignore this email.",
      });
    } else {
      const confirmUrl = `${SITE_URL}/auth/confirm?token_hash=${encodeURIComponent(tokenHash)}&type=signup`;
      subject = "Confirm your AdonisBlue account 💙";
      html = buildEmail({
        title: `Welcome, ${firstName}! 🎉`,
        body: `You're one step away from launching your AI chatbot. Confirm your email and we'll take you straight to setup — it only takes a few minutes.`,
        ctaLabel: "Confirm email & set up my bot →",
        ctaUrl: confirmUrl,
        footer: "If you didn't sign up for AdonisBlue, you can safely ignore this email.",
      });
    }

    await resend.emails.send({
      from: "AdonisBlue <hello@adonisblue.io>",
      to: toEmail,
      subject,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[send-confirmation]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function buildEmail({ title, body, ctaLabel, ctaUrl, footer }: {
  title: string; body: string; ctaLabel: string; ctaUrl: string; footer: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:#1a2744;padding:28px 32px;text-align:center;">
            <img src="https://adonisblue.io/Alona.png" alt="AdonisBlue" width="48" height="48" style="border-radius:12px;display:block;margin:0 auto 10px;" />
            <span style="color:#ffffff;font-size:20px;font-weight:600;">AdonisBlue</span>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;">
            <h1 style="margin:0 0 14px;color:#1a2744;font-size:22px;font-weight:600;">${title}</h1>
            <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.65;">${body}</p>
            <a href="${ctaUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:50px;">${ctaLabel}</a>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0 0 6px;color:#94a3b8;font-size:12px;">${footer}</p>
            <p style="margin:0;color:#cbd5e1;font-size:11px;">AdonisBlue · hello@adonisblue.io</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
