import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logError";

const resend = new Resend(process.env.RESEND_API_KEY);

const JOB_NAMES: Record<string, string> = {
  "cron:prep-reminders":       "Prep guide emails",
  "cron:reminders":            "Appointment reminder emails",
  "cron:reviews":              "Review request emails",
  "cron:treatment-reminders":  "Treatment follow-up emails",
  "cron:wellness-checkin":     "Wellness check-in emails",
  "cron:health-report":        "Daily health check",
  "cron:aftercare-nudge":      "Aftercare nudge",
  "cron:weekly-summary":       "Weekly summary",
};

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

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const since26h = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();

  const { data: rows } = await supabase
    .from("message_log")
    .select("type, status, error, created_at")
    .gte("created_at", since24h);

  const log = rows ?? [];

  // Failures (exclude emergency_alert — those have their own escalation)
  const failures = log.filter(r => r.status === "failed" && r.type !== "emergency_alert");

  // app_errors in last 24h
  const { data: appErrorRows } = await supabase
    .from("app_errors")
    .select("area, message, created_at")
    .gte("created_at", since24h)
    .order("created_at", { ascending: false });
  const appErrors = appErrorRows ?? [];

  const errorsByArea: Record<string, number> = {};
  for (const e of appErrors) {
    errorsByArea[e.area] = (errorsByArea[e.area] ?? 0) + 1;
  }

  // Check which jobs didn't run — only alert on jobs that have EVER run before
  const missedJobs: string[] = [];
  for (const [cronType, friendlyName] of Object.entries(JOB_NAMES)) {
    if (cronType === "cron:health-report") continue; // skip self

    // Check if this job has any historical rows at all (ever ran)
    const { data: ever } = await supabase
      .from("message_log")
      .select("created_at")
      .eq("type", cronType)
      .limit(1)
      .single();

    if (!ever) continue; // never ran — new/unused job, skip

    // Check if it ran in the last 26h
    const { data: recent } = await supabase
      .from("message_log")
      .select("created_at")
      .eq("type", cronType)
      .gte("created_at", since26h)
      .limit(1)
      .single();

    if (!recent) missedJobs.push(friendlyName);
  }

  const hasProblems = failures.length > 0 || appErrors.length > 0 || missedJobs.length > 0;

  // Log heartbeat before deciding whether to send
  await supabase.from("message_log").insert({
    type: "cron:health-report",
    channel: "email",
    status: "sent",
    error: `failures=${failures.length}, errors=${appErrors.length}, missed=${missedJobs.length}`,
  }).then(() => {}, () => {});

  if (!hasProblems) {
    return NextResponse.json({ ok: true, sent: false, reason: "nothing to report" });
  }

  // Build problem lines
  const problemLines: string[] = [];

  if (failures.length > 0) {
    // Group by type
    const byType: Record<string, number> = {};
    for (const f of failures) {
      byType[f.type] = (byType[f.type] ?? 0) + 1;
    }
    for (const [type, n] of Object.entries(byType)) {
      const friendly = JOB_NAMES[type] ?? type;
      problemLines.push(`⚠️ ${n} ${friendly.toLowerCase()} email${n !== 1 ? "s" : ""} failed to send`);
    }
  }

  if (missedJobs.length > 0) {
    for (const job of missedJobs) {
      problemLines.push(`⚠️ ${job} didn't go out today`);
    }
  }

  if (appErrors.length > 0) {
    const areas = Object.entries(errorsByArea)
      .map(([a, n]) => `${n} in ${a}`)
      .join(", ");
    problemLines.push(`⚠️ ${appErrors.length} background error${appErrors.length !== 1 ? "s" : ""} (${areas})`);
  }

  const linesHtml = problemLines
    .map(l => `<p style="margin:0 0 10px;font-size:15px;color:#b45309;">${escapeHtml(l)}</p>`)
    .join("");

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #fde68a;">
        <tr><td style="background:#1a2744;padding:24px 32px;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">⚠️ Something needs your attention</p>
          <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Chicago" })}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          ${linesHtml}
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />
          <p style="margin:0;font-size:13px;color:#94a3b8;">Check your dashboard or logs for more detail. Emergency alerts to clients have their own separate escalation and are not listed here.</p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">AdonisBlue · hi@adonisblue.io</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  try {
    await resend.emails.send({
      from: "AdonisBlue <hi@adonisblue.io>",
      to: "hi@adonisblue.io",
      subject: `⚠️ AdonisBlue: something needs your attention`,
      html,
    });
  } catch (e) {
    await logError("cron:health-report", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sent: true, problems: problemLines.length });
}
