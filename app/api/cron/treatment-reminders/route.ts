import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/sendAndLog";
import { firstName } from "@/lib/firstName";
import { dueDate, inReminderWindow } from "@/lib/reminderDate";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";

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

  let sentCount = 0;
  let failedCount = 0;

  try {
    // Step 2B: fetch candidates without cross-table marketing_opt_out filter
    const { data: treatments, error: treatmentsError } = await supabase
      .from("treatments")
      .select(`
        id,
        treatment_date,
        procedure_name,
        nurse_id,
        intake_id,
        procedure_id,
        intakes(first_name, email),
        procedures(name, reminder_days)
      `)
      .eq("reminder_sent", false)
      .is("rebooked_at", null)
      .not("procedure_id", "is", null)
      .eq("archived", false);

    if (treatmentsError) {
      console.error("[cron/treatment-reminders] query error:", treatmentsError.message);
      return NextResponse.json({ error: String(treatmentsError.message) }, { status: 500 });
    }

    if (!treatments || treatments.length === 0) {
      return NextResponse.json({ sent: 0 });
    }

    // Fetch marketing_opt_out separately (column not accessible via cross-table join)
    const intakeIds = [...new Set(treatments.map(t => t.intake_id).filter(Boolean))];
    const { data: intakeOptOuts } = await supabase
      .from("intakes")
      .select("id, marketing_opt_out")
      .in("id", intakeIds);
    const optOutMap = new Map((intakeOptOuts ?? []).map((i: any) => [i.id, i.marketing_opt_out]));


    // Step 2B: keep only the most recent treatment per (intake_id, procedure_id)
    const mostRecentMap = new Map<string, typeof treatments[0]>();
    for (const t of treatments) {
      const key = `${t.intake_id}:${t.procedure_id}`;
      const existing = mostRecentMap.get(key);
      if (!existing || new Date(t.treatment_date) > new Date(existing.treatment_date)) {
        mostRecentMap.set(key, t);
      }
    }

    // Mark all older (non-winner) treatments for the same procedure as reminder_sent=true
    // so they never drift into a date window and double-fire later
    const loserIds = treatments
      .filter(t => {
        const winner = mostRecentMap.get(`${t.intake_id}:${t.procedure_id}`);
        return winner && t.id !== winner.id;
      })
      .map(t => t.id);

    if (loserIds.length > 0) {
      await supabase
        .from("treatments")
        .update({ reminder_sent: true, reminder_sent_at: new Date().toISOString() })
        .in("id", loserIds);
    }

    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);

    for (const treatment of mostRecentMap.values()) {
      const reminderDays = (treatment.procedures as any)?.reminder_days;
      if (!reminderDays) continue;

      const due = dueDate(treatment.treatment_date, reminderDays);
      if (!inReminderWindow(due, todayUTC)) continue;

      const intake = Array.isArray(treatment.intakes) ? treatment.intakes[0] : treatment.intakes;
      if (optOutMap.get(treatment.intake_id)) continue;
      const clientEmail = (intake as any)?.email;
      if (!clientEmail) continue;

      const clientName = escapeHtml(firstName((intake as any)?.first_name, "Beautiful"));
      const procedureName = escapeHtml((treatment.procedures as any)?.name || treatment.procedure_name || "your treatment");

      // Step 2C: fetch bot separately; skip + log if missing
      const { data: bot } = await supabase
        .from("bots")
        .select("practice_name, booking_link, slug")
        .eq("nurse_id", treatment.nurse_id)
        .single();

      if (!bot) {
        await supabase.from("message_log").insert({
          type: "treatment_reminder",
          channel: "email",
          nurse_id: treatment.nurse_id,
          intake_id: treatment.intake_id,
          treatment_id: treatment.id,
          status: "skipped",
          error: "bot config not found",
        }).then(() => {}, () => {});
        failedCount++;
        continue;
      }

      const practiceName = escapeHtml(bot.practice_name || "your provider");
      const bookingLink = bot.booking_link || SITE_URL;

      const result = await sendEmail({
        type: "treatment_reminder",
        nurse_id: treatment.nurse_id,
        intake_id: treatment.intake_id,
        treatment_id: treatment.id,
        to: clientEmail,
        subject: `Time to refresh your ${procedureName}? ✨`,
        html: buildReminderEmail({
          clientName,
          practiceName,
          bookingLink,
          procedureName,
          reminderDays,
          slug: bot.slug ?? null,
          intakeId: treatment.intake_id,
        }),
        supabase,
      });

      if (result.ok) {
        await supabase
          .from("treatments")
          .update({ reminder_sent: true, reminder_sent_at: new Date().toISOString() })
          .eq("id", treatment.id);
        sentCount++;
      } else {
        failedCount++;
      }
    }

    return NextResponse.json({ sent: sentCount });
  } catch (e) {
    console.error("[cron/treatment-reminders] unexpected error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  } finally {
    // Step 2G: heartbeat on every post-auth exit path
    await supabase.from("message_log").insert({
      type: "cron:treatment-reminders",
      channel: "email",
      status: "sent",
      error: `sent ${sentCount}, failed ${failedCount}`,
    }).then(() => {}, () => {});
  }
}

function buildReminderEmail({
  clientName,
  practiceName,
  bookingLink,
  procedureName,
  reminderDays,
  slug,
  intakeId,
}: {
  clientName: string;
  practiceName: string;
  bookingLink: string;
  procedureName: string;
  reminderDays: number;
  slug: string | null;
  intakeId: string;
}) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#1a2744;padding:28px 32px;text-align:center;">
          <img src="${SITE_URL}/Alona.png" alt="AdonisBlue" width="44" height="44" style="border-radius:10px;display:block;margin:0 auto 10px;" />
          <span style="color:#fff;font-size:18px;font-weight:600;">${practiceName}</span>
        </td></tr>
        <tr><td style="padding:36px 32px;">
          <h1 style="margin:0 0 8px;color:#1a2744;font-size:22px;font-weight:600;">Hey ${clientName}, time for a refresh? 💙</h1>
          <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">It's been ${reminderDays} days since your <strong>${procedureName}</strong> — which means it's the perfect time to book your next appointment and keep looking and feeling your best!</p>
          <div style="background:#f0fdf4;border-radius:14px;padding:20px;margin:20px 0;text-align:center;">
            <p style="margin:0 0 12px;color:#1a2744;font-size:15px;font-weight:600;">Ready to refresh your look? ✨</p>
            <a href="${bookingLink}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:50px;">Book my appointment 💙</a>
          </div>
          <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;">We can't wait to see you again! 💕</p>
        </td></tr>
        ${slug ? `<tr>
          <td style="background:#f0fdfa;padding:24px 32px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0 0 12px;color:#1a2744;font-size:14px;font-weight:600;">Have concerns or questions?</p>
            <a href="https://www.adonisblue.io/chat/${slug}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:999px;font-size:14px;font-weight:600;">💬 Chat with ${practiceName}'s assistant</a>
            <p style="margin:12px 0 0;color:#94a3b8;font-size:12px;">Anything urgent will notify ${practiceName} to reach out to you right away.</p>
          </td>
        </tr>` : ""}
        <tr><td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0 0 6px;color:#94a3b8;font-size:12px;">Sent with care by ${practiceName} via AdonisBlue</p>
          <p style="margin:0;color:#cbd5e1;font-size:11px;"><a href="${SITE_URL}/api/unsubscribe?id=${intakeId}" style="color:#cbd5e1;text-decoration:underline;">Unsubscribe from reminders</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
