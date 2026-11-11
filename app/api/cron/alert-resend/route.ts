import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmergencyAlert } from "@/lib/sendAndLog";
import { logError } from "@/lib/logError";
import { phoneHtml } from "@/lib/formatPhone";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.adonisblue.io";
const MAX_RESENDS = 2;
const RESEND_INTERVAL_MINUTES = 15;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function resendHtml(opts: {
  clientName: string;
  clientPhone: string | null;
  clientEmail: string | null;
  flaggedMessage: string;
  resendCount: number;
  dashboardUrl: string;
}): string {
  const { clientName, clientPhone, clientEmail, flaggedMessage, dashboardUrl } = opts;
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#fef2f2;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:2px solid #ef4444;">
        <tr><td style="background:#ef4444;padding:24px 32px;text-align:center;">
          <span style="color:#fff;font-size:24px;">⚠️</span>
          <p style="margin:8px 0 0;color:#fff;font-size:18px;font-weight:700;">URGENT — Client still needs attention</p>
          <p style="margin:6px 0 0;color:#fecaca;font-size:13px;">This alert has not been marked Handled yet.</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#1a2744;font-size:16px;"><strong>${escapeHtml(clientName)}</strong> sent an emergency message:</p>
          <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0;color:#dc2626;font-size:15px;font-weight:600;">&ldquo;${escapeHtml(flaggedMessage)}&rdquo;</p>
          </div>
          <p style="margin:16px 0;color:#475569;font-size:14px;">Contact details:</p>
          ${clientEmail ? `<p style="margin:4px 0;color:#1a2744;font-size:14px;">✉️ <a href="mailto:${escapeHtml(clientEmail)}" style="color:#1a2744;">${escapeHtml(clientEmail)}</a></p>` : ""}
          ${clientPhone ? `<p style="margin:4px 0;color:#1a2744;font-size:14px;">📱 ${phoneHtml(clientPhone)}</p>` : ""}
          ${!clientEmail && !clientPhone ? `<p style="margin:4px 0;color:#94a3b8;font-size:14px;font-style:italic;">No contact info on file</p>` : ""}
          <div style="text-align:center;margin:24px 0;">
            <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:#ef4444;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:50px;">Mark as Handled in dashboard</a>
          </div>
          <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">Re-send alerts stop once you mark this Handled or after 2 re-sends.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const intervalSql = `${RESEND_INTERVAL_MINUTES} minutes`;
  let totalSent = 0;
  let totalErrors = 0;

  // ── conversations (chat emergency) ────────────────────────────────────────
  const { data: chatRows, error: chatErr } = await db
    .from("conversations")
    .select("id, nurse_id, client_name, client_phone, flagged_message, alert_resend_count, alert_last_resent_at, created_at")
    .eq("flagged", true)
    .is("handled_at", null)
    .neq("status", "resolved")
    .lt("alert_resend_count", MAX_RESENDS);

  if (chatErr) {
    await logError("cron:alert-resend", `conversations query: ${chatErr.message}`);
    totalErrors++;
  }

  for (const row of (chatRows ?? [])) {
    const baseTime: string = row.alert_last_resent_at ?? row.created_at;
    const minutesElapsed = (Date.now() - new Date(baseTime).getTime()) / 60_000;
    if (minutesElapsed < RESEND_INTERVAL_MINUTES) continue;

    // Look up nurse alert email and practice name
    const { data: bot } = await db
      .from("bots")
      .select("alert_email, notification_email, practice_name, nurse_name")
      .eq("nurse_id", row.nurse_id)
      .maybeSingle();

    let alertEmail = (bot as { alert_email?: string | null } | null)?.alert_email?.trim() ||
      (bot as { notification_email?: string | null } | null)?.notification_email?.trim() || null;
    if (!alertEmail) {
      const { data: authUser } = await db.auth.admin.getUserById(row.nurse_id);
      alertEmail = authUser?.user?.email ?? null;
    }
    if (!alertEmail) {
      await logError("cron:alert-resend", `no email for nurse ${row.nurse_id} (conversation ${row.id})`);
      totalErrors++;
      continue;
    }

    const practiceName = (bot as { practice_name?: string | null } | null)?.practice_name ?? "your practice";
    const resendCount: number = row.alert_resend_count ?? 0;
    const subject = `⚠️ Still needs attention — ${row.client_name ?? "A client"} — ${practiceName}`;

    try {
      await sendEmergencyAlert({
        nurseEmail: alertEmail,
        nurseId: row.nurse_id,
        practiceName,
        type: "chat",
        subject,
        html: resendHtml({
          clientName: row.client_name ?? "A client",
          clientPhone: row.client_phone ?? null,
          clientEmail: null,
          flaggedMessage: row.flagged_message ?? "",
          resendCount,
          dashboardUrl: SITE_URL + "/dashboard",
        }),
        supabase: db,
      });

      const { error: upErr } = await db
        .from("conversations")
        .update({
          alert_resend_count: resendCount + 1,
          alert_last_resent_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (upErr) {
        await logError("cron:alert-resend", `update conversations ${row.id}: ${upErr.message}`);
        totalErrors++;
      } else {
        totalSent++;
      }
    } catch (e) {
      await logError("cron:alert-resend", `send failed for conversation ${row.id}: ${String(e)}`);
      totalErrors++;
    }
  }

  // ── healing_chats (healing emergency) ─────────────────────────────────────
  const { data: healingRows, error: healingErr } = await db
    .from("healing_chats")
    .select("id, nurse_id, client_name, client_phone, flagged_message, alert_resend_count, alert_last_resent_at, created_at")
    .eq("flagged", true)
    .is("handled_at", null)
    .neq("status", "resolved")
    .lt("alert_resend_count", MAX_RESENDS);

  if (healingErr) {
    await logError("cron:alert-resend", `healing_chats query: ${healingErr.message}`);
    totalErrors++;
  }

  for (const row of (healingRows ?? [])) {
    const baseTime: string = row.alert_last_resent_at ?? row.created_at;
    const minutesElapsed = (Date.now() - new Date(baseTime).getTime()) / 60_000;
    if (minutesElapsed < RESEND_INTERVAL_MINUTES) continue;

    const { data: bot } = await db
      .from("bots")
      .select("alert_email, notification_email, practice_name")
      .eq("nurse_id", row.nurse_id)
      .maybeSingle();

    let alertEmail = (bot as { alert_email?: string | null } | null)?.alert_email?.trim() ||
      (bot as { notification_email?: string | null } | null)?.notification_email?.trim() || null;
    if (!alertEmail) {
      const { data: authUser } = await db.auth.admin.getUserById(row.nurse_id);
      alertEmail = authUser?.user?.email ?? null;
    }
    if (!alertEmail) {
      await logError("cron:alert-resend", `no email for nurse ${row.nurse_id} (healing_chat ${row.id})`);
      totalErrors++;
      continue;
    }

    const practiceName = (bot as { practice_name?: string | null } | null)?.practice_name ?? "your practice";
    const resendCount: number = row.alert_resend_count ?? 0;
    const subject = `⚠️ Still needs attention — ${row.client_name ?? "A client"} — ${practiceName}`;

    try {
      await sendEmergencyAlert({
        nurseEmail: alertEmail,
        nurseId: row.nurse_id,
        practiceName,
        type: "healing",
        subject,
        html: resendHtml({
          clientName: row.client_name ?? "A client",
          clientPhone: row.client_phone ?? null,
          clientEmail: null,
          flaggedMessage: row.flagged_message ?? "",
          resendCount,
          dashboardUrl: SITE_URL + "/dashboard",
        }),
        supabase: db,
      });

      const { error: upErr } = await db
        .from("healing_chats")
        .update({
          alert_resend_count: resendCount + 1,
          alert_last_resent_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (upErr) {
        await logError("cron:alert-resend", `update healing_chats ${row.id}: ${upErr.message}`);
        totalErrors++;
      } else {
        totalSent++;
      }
    } catch (e) {
      await logError("cron:alert-resend", `send failed for healing_chat ${row.id}: ${String(e)}`);
      totalErrors++;
    }
  }

  console.log(`[cron:alert-resend] sent=${totalSent} errors=${totalErrors}`);
  return NextResponse.json({ ok: true, sent: totalSent, errors: totalErrors });
}
