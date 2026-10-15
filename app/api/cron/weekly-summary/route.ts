import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logError";

const resend = new Resend(process.env.RESEND_API_KEY);

// Chicago is UTC-6 (CST) or UTC-5 (CDT). Use a consistent offset calculation.
function chicagoWeekBounds(): { weekStart: string; weekEnd: string; labelStart: string; labelEnd: string } {
  // "Last week" = the Mon–Sun block that ended yesterday.
  // We run Monday ~8am Chicago, so "last week" = the 7 days prior Mon–Sun.
  const now = new Date();
  // Offset: CDT (Mar-Nov) = UTC-5, CST (Nov-Mar) = UTC-6.
  // Simple approach: use Intl to find the current Chicago date.
  const chicagoDateStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const [mo, da, yr] = chicagoDateStr.split("/").map(Number);
  // Day of week in Chicago (0=Sun, 1=Mon…)
  const today = new Date(Date.UTC(yr, mo - 1, da));
  const dow = today.getUTCDay(); // 0=Sun
  // Last Monday: go back (dow === 1 ? 7 : (dow + 6) % 7 + 1) days from today
  // Days back to last Monday: go to this week's Monday (dow-1, or 6 if Sun), then 7 more.
  const daysToLastMon = (dow === 0 ? 6 : dow - 1) + 7;
  const lastMon = new Date(today);
  lastMon.setUTCDate(today.getUTCDate() - daysToLastMon);
  const lastSun = new Date(lastMon);
  lastSun.setUTCDate(lastMon.getUTCDate() + 6);

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

  // ISO timestamps at Chicago midnight: Mon 00:00 to Sun 23:59:59
  // Use start of Mon UTC and end of Sun UTC (approx—good enough for weekly counts)
  return {
    weekStart: lastMon.toISOString(),
    weekEnd: new Date(lastSun.getTime() + 86399999).toISOString(),
    labelStart: fmt(lastMon),
    labelEnd: fmt(lastSun),
  };
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

  const { weekStart, weekEnd, labelStart, labelEnd } = chicagoWeekBounds();

  const { data: rows } = await supabase
    .from("message_log")
    .select("type, status, error")
    .gte("created_at", weekStart)
    .lte("created_at", weekEnd);

  const log = rows ?? [];

  const count = (types: string[], status = "sent") =>
    log.filter(r => types.includes(r.type) && r.status === status).length;

  const chatReplies      = count(["chat"]);
  const aftercareSent    = count(["aftercare"]);
  const checkinsSent     = count(["wellness_checkin"]);
  const remindersSent    = count(["reminder", "prep_reminder", "treatment_reminder"]);
  const reviewsSent      = count(["review_request"]);
  const emergencySent    = count(["emergency_alert"]);
  const emergencyFailed  = count(["emergency_alert"], "failed");

  const totalFailed = log.filter(r => r.status === "failed" && r.type !== "emergency_alert").length;

  // Build lines — hide if 0 except emergency alerts
  const lines: string[] = [];
  if (chatReplies > 0)
    lines.push(`💬 Answered ${chatReplies} client message${chatReplies !== 1 ? "s" : ""}`);
  if (aftercareSent > 0 || checkinsSent > 0)
    lines.push(`💙 Sent ${aftercareSent} aftercare email${aftercareSent !== 1 ? "s" : ""} and ${checkinsSent} check-in${checkinsSent !== 1 ? "s" : ""}`);
  if (remindersSent > 0 || reviewsSent > 0)
    lines.push(`🔔 Sent ${remindersSent} reminder${remindersSent !== 1 ? "s" : ""} and ${reviewsSent} review request${reviewsSent !== 1 ? "s" : ""}`);

  // Emergency alerts always shown
  const emergencyLine = emergencyFailed > 0
    ? `🚨 Sent ${emergencySent} emergency alert${emergencySent !== 1 ? "s" : ""} to nurses — ${emergencyFailed} couldn't be delivered`
    : `🚨 Sent ${emergencySent} emergency alert${emergencySent !== 1 ? "s" : ""} to nurses — all delivered`;
  lines.push(emergencyLine);

  const closingLine = totalFailed === 0
    ? "✅ Everything worked."
    : `⚠️ ${totalFailed} email${totalFailed !== 1 ? "s" : ""} couldn't be sent.`;

  const linesHtml = lines
    .map(l => `<p style="margin:0 0 10px;font-size:15px;color:#334155;">${l}</p>`)
    .join("");

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#1a2744;padding:24px 32px;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">📊 Your AdonisBlue week</p>
          <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">${labelStart} – ${labelEnd}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 20px;font-size:15px;color:#1a2744;font-weight:600;">Here's what happened last week:</p>
          ${linesHtml}
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
          <p style="margin:0;font-size:14px;color:${totalFailed === 0 ? "#16a34a" : "#b45309"};">${closingLine}</p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">AdonisBlue weekly summary · hi@adonisblue.io</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  try {
    await resend.emails.send({
      from: "AdonisBlue <hi@adonisblue.io>",
      to: "hi@adonisblue.io",
      subject: `📊 Your AdonisBlue week: ${labelStart} – ${labelEnd}`,
      html,
    });
  } catch (e) {
    await logError("cron:weekly-summary", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  await supabase.from("message_log").insert({
    type: "cron:weekly-summary",
    channel: "email",
    status: "sent",
    error: `chat=${chatReplies} aftercare=${aftercareSent} checkins=${checkinsSent} reminders=${remindersSent} reviews=${reviewsSent} emergency=${emergencySent}`,
  }).then(() => {}, () => {});

  return NextResponse.json({ ok: true, week: `${labelStart} – ${labelEnd}` });
}
