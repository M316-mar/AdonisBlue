import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/sendAndLog";
import { logError } from "@/lib/logError";
import { formatTreatmentDate } from "@/lib/formatTreatmentDate";
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

  let sent = 0;
  let skipped = 0;

  try {
    const now = new Date();
    // Treatments where aftercare_sent=false, treatment_date was 1–14 days ago
    const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const todayStart = now.toISOString().slice(0, 10) + "T00:00:00.000Z";

    const { data: treatments, error } = await supabase
      .from("treatments")
      .select(`
        id,
        treatment_date,
        procedure_name,
        nurse_id,
        intake_id,
        intakes(id, first_name)
      `)
      .is("aftercare_sent_at", null)
      .eq("archived", false)
      .gte("treatment_date", fourteenDaysAgo)
      .lte("treatment_date", oneDayAgo)
      .not("intake_id", "is", null);

    if (error) {
      console.error("[aftercare-nudge] query error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!treatments || treatments.length === 0) {
      return NextResponse.json({ sent: 0, skipped: 0 });
    }

    // Group by nurse
    const byNurse = new Map<string, typeof treatments>();
    for (const t of treatments) {
      const arr = byNurse.get(t.nurse_id) ?? [];
      arr.push(t);
      byNurse.set(t.nurse_id, arr);
    }

    for (const [nurseId, nurseTs] of byNurse.entries()) {
      // Max one nudge per nurse per day
      const { data: alreadySent } = await supabase
        .from("message_log")
        .select("id")
        .eq("type", "aftercare_nudge")
        .eq("nurse_id", nurseId)
        .gte("created_at", todayStart)
        .limit(1)
        .single();

      if (alreadySent) {
        skipped++;
        continue;
      }

      // Resolve nurse email via Supabase Auth admin
      const { data: nurseData } = await supabase.auth.admin.getUserById(nurseId);
      const nurseEmail = nurseData?.user?.email;

      if (!nurseEmail) {
        await supabase.from("message_log").insert({
          type: "aftercare_nudge",
          channel: "email",
          nurse_id: nurseId,
          status: "skipped",
          error: "nurse email not found",
        }).then(() => {}, () => {});
        skipped++;
        continue;
      }

      // Fetch practice name
      const { data: bot } = await supabase
        .from("bots")
        .select("practice_name")
        .eq("nurse_id", nurseId)
        .single();

      const practiceName = escapeHtml(bot?.practice_name || "your practice");

      // Build client rows for the email
      const clientRows = nurseTs
        .map(t => {
          const intake = Array.isArray(t.intakes) ? t.intakes[0] : t.intakes;
          const name = escapeHtml((intake as any)?.first_name || "Client");
          const date = formatTreatmentDate(t.treatment_date, { month: "short", day: "numeric" });
          const procedure = escapeHtml(t.procedure_name || "Treatment");
          return `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#1a2744;">${name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#475569;">${procedure}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#475569;">${date}</td>
          </tr>`;
        })
        .join("");

      const count = nurseTs.length;

      const result = await sendEmail({
        type: "aftercare_nudge",
        nurse_id: nurseId,
        to: nurseEmail,
        subject: `${count} client${count === 1 ? " hasn't" : "s haven't"} received aftercare yet 💙`,
        html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Aftercare reminder</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:#1a2744;padding:24px 32px;text-align:center;">
            <img src="https://adonisblue.io/Alona.png" alt="AdonisBlue" width="40" height="40" style="border-radius:10px;display:block;margin:0 auto 10px;" />
            <span style="color:#ffffff;font-size:17px;font-weight:600;">${practiceName} — Aftercare Reminder</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 12px;color:#1a2744;font-size:20px;font-weight:600;">
              ${count} client${count === 1 ? " hasn't" : "s haven't"} received aftercare yet 💙
            </h1>
            <p style="margin:0 0 24px;color:#475569;font-size:14px;line-height:1.6;">
              The following client${count === 1 ? " has" : "s have"} a treatment in the last 14 days but no aftercare email has been sent yet. Head to your dashboard to send it now.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
              <tr style="background:#f8fafc;">
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">Client</th>
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">Procedure</th>
                <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">Treatment date</th>
              </tr>
              ${clientRows}
            </table>
            <div style="text-align:center;">
              <a href="https://www.adonisblue.io/dashboard" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:50px;">
                Go to dashboard →
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">AdonisBlue aftercare nudge · sent to ${escapeHtml(nurseEmail)}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
        supabase,
      });

      if (result.ok) sent++;
      else skipped++;
    }

    return NextResponse.json({ sent, skipped });
  } catch (e) {
    console.error("[aftercare-nudge] unexpected error:", e);
    await logError("cron:aftercare-nudge", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  } finally {
    // Step 2G: heartbeat on every post-auth exit path
    await supabase.from("message_log").insert({
      type: "cron:aftercare-nudge",
      channel: "email",
      status: "sent",
      error: `sent ${sent}, skipped ${skipped}`,
    }).then(() => {}, () => {});
  }
}
