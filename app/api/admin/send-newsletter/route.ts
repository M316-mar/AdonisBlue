import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";

export async function POST(request: Request) {
  try {
    const { subject, content, preview_text } = await request.json();

    if (!subject || !content) {
      return NextResponse.json({ error: "Subject and content required" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all active nurse emails from auth
    const { data: users } = await supabase.auth.admin.listUsers();
    const nurseEmails = (users?.users ?? [])
      .filter(u => u.email)
      .map(u => u.email as string);

    if (nurseEmails.length === 0) {
      return NextResponse.json({ error: "No nurses to send to" }, { status: 400 });
    }

    // Convert plain text content to HTML paragraphs
    const htmlContent = content
      .split("\n\n")
      .filter((p: string) => p.trim())
      .map((p: string) => `<p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">${p.trim().replace(/\n/g, "<br/>")}</p>`)
      .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <!-- Header -->
        <tr>
          <td style="background:#1a2744;padding:28px 32px;text-align:center;">
            <img src="${SITE_URL}/Alona.png" alt="AdonisBlue" width="44" height="44" style="border-radius:10px;display:block;margin:0 auto 10px;" />
            <span style="color:#ffffff;font-size:20px;font-weight:600;">AdonisBlue</span>
            <p style="margin:6px 0 0;color:#94a3b8;font-size:12px;">The Blue Room Newsletter 💙</p>
          </td>
        </tr>
        <!-- Preview text -->
        ${preview_text ? `<tr><td style="background:#f0fdf4;padding:12px 32px;border-bottom:1px solid #e2e8f0;"><p style="margin:0;color:#0d9488;font-size:13px;font-weight:600;">✨ ${preview_text}</p></td></tr>` : ""}
        <!-- Body -->
        <tr>
          <td style="padding:36px 32px;">
            <h1 style="margin:0 0 20px;color:#1a2744;font-size:24px;font-weight:700;line-height:1.3;">${subject}</h1>
            ${htmlContent}
          </td>
        </tr>
        <!-- CTA -->
        <tr>
          <td style="padding:0 32px 32px;">
            <div style="background:#f0fdf4;border-radius:14px;padding:20px;text-align:center;border:1px solid #d1fae5;">
              <p style="margin:0 0 12px;color:#1a2744;font-size:14px;font-weight:600;">Ready to grow your practice?</p>
              <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:50px;">Go to my dashboard 💙</a>
            </div>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;">You're receiving this because you're an AdonisBlue member.</p>
            <p style="margin:0;color:#cbd5e1;font-size:11px;">AdonisBlue · hello@adonisblue.io</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // Send to all nurses
    let sentCount = 0;
    for (const email of nurseEmails) {
      try {
        await resend.emails.send({
          from: "AdonisBlue <hello@adonisblue.io>",
          to: email,
          subject,
          html,
        });
        sentCount++;
      } catch (e) {
        console.error(`Failed to send to ${email}:`, e);
      }
    }

    // Save to newsletters table
    await supabase.from("newsletters").insert({
      subject,
      content,
      sent_to: "nurses",
      sent_count: sentCount,
    });

    return NextResponse.json({ success: true, sent_count: sentCount });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
