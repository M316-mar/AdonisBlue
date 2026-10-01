import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

// SQL to add the new column (run once in Supabase SQL editor):
//
//   ALTER TABLE treatments ADD COLUMN IF NOT EXISTS wellness_checkin_sent_at timestamptz;
//   GRANT SELECT, UPDATE ON treatments TO service_role;
//   GRANT SELECT ON treatments TO anon;
//   GRANT SELECT ON treatments TO authenticated;

const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.adonisblue.io";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find treatments where aftercare was sent 16–40 hours ago and check-in hasn't fired yet.
  // 24h-wide window ensures every client falls into exactly one daily run regardless of
  // what time of day the nurse sent aftercare. wellness_checkin_sent_at IS NULL is the dedup.
  const now = new Date();
  const windowEnd = new Date(now.getTime() - 16 * 60 * 60 * 1000);   // 16h ago
  const windowStart = new Date(now.getTime() - 40 * 60 * 60 * 1000); // 40h ago

  const { data: treatments, error } = await supabase
    .from("treatments")
    .select(`
      id,
      procedure_name,
      intake_id,
      nurse_id,
      intakes (
        id,
        first_name,
        email,
        nurse_id
      )
    `)
    .eq("aftercare_sent", true)
    .is("wellness_checkin_sent_at", null)
    .gte("aftercare_sent_at", windowStart.toISOString())
    .lte("aftercare_sent_at", windowEnd.toISOString())
    .eq("archived", false);

  if (error) {
    console.error("[wellness-checkin] query error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { treatment_id: string; status: string }[] = [];

  for (const treatment of treatments ?? []) {
    const intake = Array.isArray(treatment.intakes) ? treatment.intakes[0] : treatment.intakes;
    if (!intake?.email) continue;

    const nurseId = treatment.nurse_id ?? intake.nurse_id;

    // Fetch bot for practice name, slug, nurse phone
    const { data: bot } = await supabase
      .from("bots")
      .select("practice_name, slug, phone")
      .eq("nurse_id", nurseId)
      .single();

    const practiceName = escapeHtml(bot?.practice_name || "your provider");
    const clientName = escapeHtml(intake.first_name || "there");
    const procedureName = escapeHtml(treatment.procedure_name || "your treatment");
    const healingLink = `${SITE_URL}/healing/${treatment.id}`;
    const nursePhone = escapeHtml(bot?.phone || "");
    const slug = bot?.slug ?? null;

    const emergencyLine = nursePhone
      ? `If you have severe pain, vision changes, skin turning white, grey, or blue, or trouble breathing, call 911 or go to the nearest ER immediately — then contact me at ${nursePhone}.`
      : `If you have severe pain, vision changes, skin turning white, grey, or blue, or trouble breathing, call 911 or go to the nearest ER immediately.`;

    try {
      await resend.emails.send({
        from: "AdonisBlue <hi@adonisblue.io>",
        to: intake.email,
        subject: `Checking in — how are you feeling after your ${treatment.procedure_name || "appointment"}?`,
        html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Checking in on you 💙</title></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
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
            <h1 style="margin:0 0 12px;color:#1a2744;font-size:22px;font-weight:600;">Hi ${clientName} — just checking in 💙</h1>
            <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.7;">
              It's been about 24 hours since your ${procedureName} at ${practiceName}. How are you feeling? Hopefully you're healing beautifully — but if anything feels off or you have questions, your recovery chat is open any time.
            </p>
            <div style="background:#fef9c3;border-radius:12px;border:1px solid #fde68a;padding:16px 20px;margin:0 0 24px;">
              <p style="margin:0;color:#92400e;font-size:13px;line-height:1.6;">
                ⚠️ ${emergencyLine}
              </p>
            </div>
            ${slug ? `
            <div style="background:#f0fdfa;border-radius:14px;border:1px solid #99f6e4;padding:24px;margin:0 0 24px;text-align:center;">
              <p style="margin:0 0 12px;color:#1a2744;font-size:14px;font-weight:600;">Have concerns or questions?</p>
              <a href="${healingLink}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:999px;font-size:14px;font-weight:600;">💬 Open recovery chat</a>
              <p style="margin:12px 0 0;color:#94a3b8;font-size:12px;">Anything urgent will notify ${practiceName} to reach out to you right away.</p>
            </div>` : ""}
            <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.6;">
              Take good care — we're always here if you need us. 💕
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;">Sent with care by ${practiceName} via AdonisBlue</p>
            <p style="margin:0;color:#cbd5e1;font-size:11px;">
              <a href="${SITE_URL}/api/unsubscribe?id=${intake.id}" style="color:#cbd5e1;text-decoration:underline;">Unsubscribe from these emails</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      });

      const { error: updateError } = await supabase
        .from("treatments")
        .update({ wellness_checkin_sent_at: new Date().toISOString() })
        .eq("id", treatment.id);

      if (updateError) {
        console.error(`[wellness-checkin] failed to mark sent for treatment ${treatment.id}:`, updateError.message);
      }

      results.push({ treatment_id: treatment.id, status: "sent" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[wellness-checkin] send failed for treatment ${treatment.id}:`, msg);
      results.push({ treatment_id: treatment.id, status: `error: ${msg}` });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
