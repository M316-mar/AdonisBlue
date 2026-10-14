import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

const CRON_NAMES = [
  "cron:prep-reminders",
  "cron:reminders",
  "cron:reviews",
  "cron:treatment-reminders",
  "cron:wellness-checkin",
  "cron:aftercare-nudge",
  "cron:health-report",
];

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
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

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since26h = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();

  // Fetch all message_log rows from last 24h
  const { data: rows } = await supabase
    .from("message_log")
    .select("type, status, nurse_id, error, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const logRows = rows ?? [];

  // Group by type: counts per status
  const byType: Record<string, { sent: number; failed: number; skipped: number }> = {};
  for (const row of logRows) {
    if (!byType[row.type]) byType[row.type] = { sent: 0, failed: 0, skipped: 0 };
    if (row.status === "sent") byType[row.type].sent++;
    else if (row.status === "failed") byType[row.type].failed++;
    else if (row.status === "skipped") byType[row.type].skipped++;
  }

  // app_errors: structured errors from logError()
  const { data: appErrorRows } = await supabase
    .from("app_errors")
    .select("area, message, nurse_id, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  const appErrors = appErrorRows ?? [];

  // Group app_errors by area
  const errorsByArea: Record<string, number> = {};
  for (const e of appErrors) {
    errorsByArea[e.area] = (errorsByArea[e.area] ?? 0) + 1;
  }

  // All failures in detail
  const failures = logRows.filter((r) => r.status === "failed");

  // Emergency alert counts
  const emergencyRows = logRows.filter((r) => r.type === "emergency_alert" || r.type === "chat" || r.type === "healing" || r.type === "review");
  const emergencySent = emergencyRows.filter((r) => r.status === "sent").length;
  const emergencyFailed = emergencyRows.filter((r) => r.status === "failed").length;

  // Check cron heartbeats (last 26h)
  const missedCrons: string[] = [];
  for (const cronType of CRON_NAMES) {
    const { data: heartbeat } = await supabase
      .from("message_log")
      .select("created_at")
      .eq("type", cronType)
      .gte("created_at", since26h)
      .limit(1)
      .single();
    if (!heartbeat) missedCrons.push(cronType);
  }

  // Build summary rows HTML
  const typeRows = Object.entries(byType)
    .filter(([type]) => !type.startsWith("cron:"))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, counts]) => `
      <tr>
        <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-family:monospace;font-size:13px;color:#334155;">${escapeHtml(type)}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;color:#16a34a;font-weight:600;">${counts.sent}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;color:${counts.failed > 0 ? "#dc2626" : "#94a3b8"};font-weight:${counts.failed > 0 ? "700" : "400"};">${counts.failed}</td>
        <td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:center;color:#94a3b8;">${counts.skipped}</td>
      </tr>`)
    .join("");

  const failureRows = failures.map((f) => {
    // Strip msg:... fingerprint — never include client message text in this report
    const safeError = escapeHtml(
      (f.error ?? "—").replace(/\s*\bmsg:.+$/i, "").trim() || "—"
    );
    return `
    <tr>
      <td style="padding:6px 12px;border-bottom:1px solid #fecaca;font-family:monospace;font-size:12px;color:#334155;">${escapeHtml(f.type)}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #fecaca;font-size:12px;color:#64748b;">${escapeHtml(f.nurse_id ?? "—")}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #fecaca;font-size:12px;color:#64748b;">${escapeHtml(new Date(f.created_at).toISOString())}</td>
      <td style="padding:6px 12px;border-bottom:1px solid #fecaca;font-size:12px;color:#dc2626;word-break:break-word;max-width:280px;">${safeError}</td>
    </tr>`;
  }).join("");

  const missedCronHtml = missedCrons.length > 0
    ? `<div style="background:#fef9c3;border:1px solid #fde047;border-radius:10px;padding:16px;margin:20px 0;">
        <p style="margin:0 0 8px;font-weight:700;color:#854d0e;font-size:14px;">⚠️ Missed cron heartbeats (no run in last 26h):</p>
        ${missedCrons.map((c) => `<p style="margin:2px 0;font-family:monospace;font-size:13px;color:#92400e;">${escapeHtml(c)}</p>`).join("")}
       </div>`
    : `<p style="color:#16a34a;font-size:13px;">✅ All crons ran on schedule.</p>`;

  const allGood = failures.length === 0 && missedCrons.length === 0 && appErrors.length === 0;

  // ── Promise checks — one line each ──────────────────────────────────────────
  function check(label: string, ok: boolean, note?: string): string {
    const icon = ok ? "✅" : "⚠️";
    const detail = !ok && note ? ` — ${escapeHtml(note)}` : "";
    return `<li style="padding:4px 0;font-size:14px;color:#334155;">${icon} ${escapeHtml(label)}${detail}</li>`;
  }

  const chatSent    = (byType["chat"]?.sent ?? 0);
  const chatFailed  = (byType["chat"]?.failed ?? 0);
  const aftercareSent = (byType["aftercare"]?.sent ?? 0);
  const checkinsSent  = (byType["wellness_checkin"]?.sent ?? 0);
  const remindersSent = (byType["reminder"]?.sent ?? 0) + (byType["prep_reminder"]?.sent ?? 0) + (byType["treatment_reminder"]?.sent ?? 0);
  const reviewsSent   = (byType["review_request"]?.sent ?? 0);
  const emergencyAlerts = logRows.filter(r => r.type === "emergency_alert" && r.status === "sent").length;
  const emergencyFails  = logRows.filter(r => r.type === "emergency_alert" && r.status === "failed").length;
  const paymentsSaved = logRows.filter(r => r.type === "payment" && r.status === "sent").length;

  const promiseChecksHtml = `
    <ul style="list-style:none;margin:0;padding:0;">
      ${check("Chat replies", chatFailed === 0, chatFailed > 0 ? `${chatFailed} failed` : undefined)}
      ${check("Emergency alerts", emergencyFails === 0, emergencyFails > 0 ? `${emergencyFails} failed` : undefined)}
      ${check("Aftercare sent", true, aftercareSent > 0 ? `${aftercareSent} sent` : "none sent (may be normal)")}
      ${check("Check-ins sent", true, checkinsSent > 0 ? `${checkinsSent} sent` : "none sent (may be normal)")}
      ${check("Reminders sent", true, remindersSent > 0 ? `${remindersSent} sent` : "none sent (may be normal)")}
      ${check("Review requests", true, reviewsSent > 0 ? `${reviewsSent} sent` : "none sent (may be normal)")}
      ${check("New payments saved", true, paymentsSaved > 0 ? `${paymentsSaved} saved` : "none (may be normal)")}
      ${check("Cron heartbeats", missedCrons.length === 0, missedCrons.length > 0 ? `missed: ${missedCrons.join(", ")}` : undefined)}
      ${check("Errors (app_errors)", appErrors.length === 0, appErrors.length > 0 ? `${appErrors.length} total — areas: ${Object.entries(errorsByArea).map(([a, n]) => `${a}(${n})`).join(", ")}` : undefined)}
    </ul>`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#1a2744;padding:24px 32px;text-align:center;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">AdonisBlue Daily Health Report ${allGood ? "✅" : "⚠️"}</p>
          <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">${new Date().toUTCString()}</p>
        </td></tr>
        <tr><td style="padding:32px;">

          <h2 style="margin:0 0 12px;color:#1a2744;font-size:15px;font-weight:700;">Promise checks</h2>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:24px;">
            ${promiseChecksHtml}
          </div>

          ${allGood ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px;margin-bottom:20px;text-align:center;"><p style="margin:0;color:#16a34a;font-size:15px;font-weight:700;">All good ✅ — no failures, all crons ran.</p></div>` : ""}

          <h2 style="margin:0 0 12px;color:#1a2744;font-size:15px;font-weight:700;">Last 24h sends by type</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:24px;">
            <tr style="background:#f8fafc;">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;">Type</th>
              <th style="padding:8px 12px;text-align:center;font-size:12px;color:#16a34a;font-weight:600;">Sent</th>
              <th style="padding:8px 12px;text-align:center;font-size:12px;color:#dc2626;font-weight:600;">Failed</th>
              <th style="padding:8px 12px;text-align:center;font-size:12px;color:#94a3b8;font-weight:600;">Skipped</th>
            </tr>
            ${typeRows || `<tr><td colspan="4" style="padding:12px;text-align:center;color:#94a3b8;font-size:13px;">No sends in the last 24h</td></tr>`}
          </table>

          <h2 style="margin:0 0 12px;color:#1a2744;font-size:15px;font-weight:700;">Emergency alerts (last 24h)</h2>
          <p style="margin:0 0 20px;font-size:14px;color:#475569;">Sent: <strong style="color:#16a34a;">${emergencySent}</strong> &nbsp;|&nbsp; Failed: <strong style="color:${emergencyFailed > 0 ? "#dc2626" : "#94a3b8"};">${emergencyFailed}</strong></p>

          <h2 style="margin:0 0 12px;color:#1a2744;font-size:15px;font-weight:700;">Cron heartbeats</h2>
          ${missedCronHtml}

          ${failures.length > 0 ? `
          <h2 style="margin:20px 0 12px;color:#dc2626;font-size:15px;font-weight:700;">⚠️ Failures (${failures.length})</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fecaca;border-radius:10px;overflow:hidden;">
            <tr style="background:#fef2f2;">
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#dc2626;font-weight:600;">Type</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#dc2626;font-weight:600;">Nurse ID</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#dc2626;font-weight:600;">Time</th>
              <th style="padding:8px 12px;text-align:left;font-size:12px;color:#dc2626;font-weight:600;">Error</th>
            </tr>
            ${failureRows}
          </table>` : ""}

        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">AdonisBlue automated health report · hi@adonisblue.io</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  await resend.emails.send({
    from: "AdonisBlue <hi@adonisblue.io>",
    to: "hi@adonisblue.io",
    subject: `AdonisBlue Health Report ${allGood ? "✅" : "⚠️"} — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
    html,
  });

  // Log heartbeat for this cron
  await supabase.from("message_log").insert({
    type: "cron:health-report",
    channel: "email",
    status: "sent",
    error: `failures=${failures.length}, missed_crons=${missedCrons.length}`,
  });

  return NextResponse.json({ ok: true, failures: failures.length, missed_crons: missedCrons.length });
}
