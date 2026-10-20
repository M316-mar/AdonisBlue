import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { logError } from "@/lib/logError";
import { dueDate } from "@/lib/reminderDate";

const resend = new Resend(process.env.RESEND_API_KEY);

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.adonisblue.io";

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

  try {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const thirtyDaysOut = new Date(today);
    thirtyDaysOut.setUTCDate(today.getUTCDate() + 30);

    // Fetch all non-archived, non-rebooked treatments with reminder_days
    const { data: treatments, error: tErr } = await supabase
      .from("treatments")
      .select("id, treatment_date, procedure_id, procedure_name, nurse_id, intake_id, procedures(name, reminder_days), intakes(first_name, marketing_opt_out)")
      .eq("archived", false)
      .is("rebooked_at", null)
      .not("procedure_id", "is", null);

    if (tErr) {
      await logError("cron:return-reminder", tErr.message);
      return NextResponse.json({ error: tErr.message }, { status: 500 });
    }

    // Most recent treatment per (nurse_id, intake_id, procedure_id)
    const mostRecentMap = new Map<string, typeof treatments[0]>();
    for (const t of treatments ?? []) {
      const key = `${t.nurse_id}:${t.intake_id}:${t.procedure_id}`;
      const existing = mostRecentMap.get(key);
      if (!existing || new Date(t.treatment_date) > new Date(existing.treatment_date)) {
        mostRecentMap.set(key, t);
      }
    }

    // Group yellow clients by nurse_id
    const byNurse = new Map<string, Array<{ clientName: string; procedureName: string; dueISO: string }>>();

    for (const t of mostRecentMap.values()) {
      const reminderDays = (t.procedures as any)?.reminder_days as number | null;
      if (!reminderDays) continue;

      const intake = Array.isArray(t.intakes) ? t.intakes[0] : t.intakes;
      if ((intake as any)?.marketing_opt_out) continue;

      const due = dueDate(t.treatment_date, reminderDays);
      if (due > thirtyDaysOut) continue; // not due within 30 days yet

      const nurseId = t.nurse_id;
      if (!byNurse.has(nurseId)) byNurse.set(nurseId, []);
      byNurse.get(nurseId)!.push({
        clientName: (intake as any)?.first_name || "A client",
        procedureName: (t.procedures as any)?.name || t.procedure_name || "their treatment",
        dueISO: due.toISOString().slice(0, 10),
      });
    }

    // Send one email per nurse who has yellow clients
    for (const [nurseId, clients] of byNurse) {
      if (clients.length === 0) continue;

      // Fetch nurse email from bots + auth
      const { data: bot } = await supabase
        .from("bots")
        .select("alert_email, notification_email, practice_name")
        .eq("nurse_id", nurseId)
        .single();

      if (!bot) continue;

      const nurseEmail = bot.alert_email || bot.notification_email;
      if (!nurseEmail) continue;

      const practiceName = bot.practice_name || "your practice";

      // Sort by due date
      clients.sort((a, b) => a.dueISO.localeCompare(b.dueISO));

      const clientLines = clients.map((c) => {
        const dueFormatted = new Date(c.dueISO + "T00:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric" });
        return `<p style="margin:0 0 10px;font-size:15px;color:#334155;">🟡 <strong>${c.clientName}</strong> is due back for ${c.procedureName} around ${dueFormatted}.</p>`;
      }).join("");

      const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#1a2744;padding:24px 32px;">
          <img src="${SITE_URL}/Alona.png" alt="AdonisBlue" width="36" height="36" style="border-radius:8px;display:block;margin:0 auto 8px;" />
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700;text-align:center;">🔁 Clients coming back soon</p>
          <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;text-align:center;">${practiceName} · Save them a spot this week.</p>
        </td></tr>
        <tr><td style="padding:32px;">
          ${clientLines}
          <div style="margin-top:20px;text-align:center;">
            <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#0d9488;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:50px;">View dashboard 💙</a>
          </div>
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
          to: nurseEmail,
          subject: `🔁 ${clients.length} client${clients.length !== 1 ? "s" : ""} due back soon — save them a spot`,
          html,
        });
        sent++;
      } catch (e) {
        await logError("cron:return-reminder", String(e));
      }
    }

    await supabase.from("message_log").insert({
      type: "cron:return-reminder",
      channel: "email",
      status: "sent",
      error: `sent ${sent} nurse emails`,
    }).then(() => {}, () => {});

    return NextResponse.json({ ok: true, sent });
  } catch (e) {
    await logError("cron:return-reminder", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
