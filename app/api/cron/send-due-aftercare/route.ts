import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logError";
import { sendEmail } from "@/lib/sendAndLog";
import { getClientSender } from "@/lib/clientEmailSender";
import { firstName } from "@/lib/firstName";
import { substitutePlaceholdersSafeHtml } from "@/lib/substitutePlaceholders";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date().toISOString();
  const staleClaimBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  // Fetch treatments that are due, not yet sent, and not currently being claimed
  const { data: due, error: fetchErr } = await supabase
    .from("treatments")
    .select("id, nurse_id, intake_id, procedure_id, procedure_name")
    .lte("aftercare_send_at", now)
    .is("aftercare_sent_at", null)
    .is("aftercare_canceled_at", null)
    .or(`aftercare_claimed_at.is.null,aftercare_claimed_at.lt.${staleClaimBefore}`)
    .eq("archived", false)
    .limit(50);

  if (fetchErr) {
    await logError("cron:send-due-aftercare", `fetch: ${fetchErr.message}`);
    return NextResponse.json({ error: "DB fetch failed" }, { status: 500 });
  }

  if (!due || due.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const treatment of due) {
    // Atomic claim — only one worker can own a row at a time
    const claimAt = new Date().toISOString();
    const { data: claimed, error: claimErr } = await supabase
      .from("treatments")
      .update({ aftercare_claimed_at: claimAt })
      .eq("id", treatment.id)
      .is("aftercare_sent_at", null)
      .or(`aftercare_claimed_at.is.null,aftercare_claimed_at.lt.${staleClaimBefore}`)
      .select("id")
      .maybeSingle();

    if (claimErr) {
      await logError("cron:send-due-aftercare", `claim ${treatment.id}: ${claimErr.message}`);
      skipped++;
      continue;
    }
    if (!claimed) {
      // Another worker claimed this row between the fetch and the UPDATE
      skipped++;
      continue;
    }

    // Fetch related data needed to build the email
    const [intakeRes, botRes, procRes] = await Promise.all([
      treatment.intake_id
        ? supabase.from("intakes").select("first_name, email").eq("id", treatment.intake_id).single()
        : Promise.resolve({ data: null, error: null }),
      supabase.from("bots").select("practice_name, nurse_name, alert_phone, phone_public, alert_email, alert_email_verified, notification_email").eq("nurse_id", treatment.nurse_id).single(),
      treatment.procedure_id
        ? supabase.from("procedures").select("name, aftercare_instructions").eq("id", treatment.procedure_id).single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const intake = intakeRes.data;
    const bot = botRes.data;
    const proc = procRes.data;

    if (!intake?.email) {
      // No email — clear claim so it doesn't block future runs, mark as not sendable
      await supabase.from("treatments").update({ aftercare_claimed_at: null, aftercare_send_at: null }).eq("id", treatment.id);
      await logError("cron:send-due-aftercare", `no email for treatment ${treatment.id}`);
      skipped++;
      continue;
    }

    const practiceName = bot?.practice_name || "your provider";
    const nurseDisplayName = bot?.nurse_name || bot?.practice_name || "";
    const nursePhone = bot?.phone_public || bot?.alert_phone || "";
    const clientName = firstName(intake.first_name, "beautiful");
    const procName = proc?.name || treatment.procedure_name || "your treatment";
    const rawInstructions = (proc?.aftercare_instructions ?? "").trim()
      || "Take it easy, stay hydrated, and avoid strenuous activity for 24 hours.";
    const instructionsHtml = substitutePlaceholdersSafeHtml(rawInstructions, nurseDisplayName, nursePhone);

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#1a2744;padding:28px 32px;text-align:center;">
          <img src="${SITE_URL}/Alona.png" alt="AdonisBlue" width="44" height="44" style="border-radius:10px;display:block;margin:0 auto 10px;" />
          <span style="color:#fff;font-size:18px;font-weight:600;">${escapeHtml(practiceName)}</span>
        </td></tr>
        <tr><td style="padding:36px 32px;">
          <h1 style="margin:0 0 8px;color:#1a2744;font-size:22px;font-weight:600;">You're glowing, ${escapeHtml(clientName)}! 🌸</h1>
          <p style="margin:0 0 8px;color:#475569;font-size:14px;">Thank you for your visit. Here are your aftercare instructions:</p>
          <div style="background:#f0fdf4;border-radius:14px;padding:20px;margin:16px 0;border-left:4px solid #0d9488;">
            <h3 style="margin:0 0 10px;color:#0d9488;font-size:15px;font-weight:600;">📋 ${escapeHtml(procName)} Aftercare</h3>
            <p style="margin:0;color:#1a2744;font-size:14px;line-height:1.75;white-space:pre-wrap;">${instructionsHtml}</p>
          </div>
          <div style="background:#1a2744;border-radius:14px;padding:20px;margin:20px 0;text-align:center;">
            <p style="margin:0 0 8px;color:#ffffff;font-size:15px;font-weight:600;">Have recovery questions? 💙</p>
            <p style="margin:0 0 12px;color:#94a3b8;font-size:13px;">Our 24/7 recovery chat is here for you.</p>
            <a href="${SITE_URL}/healing/${treatment.id}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:50px;">💬 Open recovery chat</a>
          </div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">Sent with care by ${escapeHtml(practiceName)} via AdonisBlue</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const { from_name, reply_to } = getClientSender(bot ?? {});
    const result = await sendEmail({
      type: "aftercare",
      nurse_id: treatment.nurse_id,
      treatment_id: treatment.id,
      intake_id: treatment.intake_id,
      to: intake.email,
      subject: `Your aftercare instructions from ${practiceName} 💙`,
      html,
      supabase,
      from_name,
      reply_to,
    });

    if (!result.ok) {
      // Clear claim so the next run retries, but leave aftercare_send_at intact
      await supabase.from("treatments").update({ aftercare_claimed_at: null }).eq("id", treatment.id);
      await logError("cron:send-due-aftercare", `send failed for ${treatment.id}: ${result.error}`);
      failed++;
      continue;
    }

    const sentAt = new Date().toISOString();
    const { error: markErr } = await supabase
      .from("treatments")
      .update({
        aftercare_sent: true,
        aftercare_sent_at: sentAt,
        aftercare_send_at: null,
        aftercare_claimed_at: null,
      })
      .eq("id", treatment.id);

    if (markErr) {
      await logError("cron:send-due-aftercare", `mark-sent ${treatment.id}: ${markErr.message}`);
    }

    if (treatment.intake_id) {
      await supabase.from("intakes").update({ aftercare_sent_at: sentAt }).eq("id", treatment.intake_id);
    }

    sent++;
  }

  return NextResponse.json({ ok: true, sent, skipped, failed });
}
