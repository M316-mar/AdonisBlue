import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/sendAndLog";
import { logError } from "@/lib/logError";
import { firstName } from "@/lib/firstName";

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
  let failed = 0;

  try {
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const nineMonthsAgo = new Date(now);
    nineMonthsAgo.setMonth(nineMonthsAgo.getMonth() - 9);

    // Step 1: eligible intakes — opted in, email set
    const { data: eligibleIntakes, error: intakesError } = await supabase
      .from("intakes")
      .select("id, first_name, email, nurse_id")
      .eq("marketing_opt_out", false)
      .not("email", "is", null);

    if (intakesError) {
      console.error("[cron/reminders] intakes query error:", intakesError.message);
      return NextResponse.json({ error: String(intakesError.message) }, { status: 500 });
    }

    if (!eligibleIntakes?.length) {
      return NextResponse.json({ success: true, sent: 0 });
    }

    const intakeIds = eligibleIntakes.map((i: any) => i.id);

    // Step 2: ALL non-archived treatments for those intakes (no date filter here —
    // we need the most recent overall to avoid sending a "come back" email when the
    // client already came back recently)
    const { data: allTreatments, error: treatmentsError } = await supabase
      .from("treatments")
      .select("id, treatment_date, intake_id, procedure_id, nurse_id, reminder_6m_sent_at, reminder_9m_sent_at, procedures(reminder_days)")
      .in("intake_id", intakeIds)
      .is("rebooked_at", null)
      .eq("archived", false);

    if (treatmentsError) {
      console.error("[cron/reminders] treatments query error:", treatmentsError.message);
      return NextResponse.json({ error: String(treatmentsError.message) }, { status: 500 });
    }

    // Step 3: most recent treatment per intake (across ALL dates)
    const mostRecentByIntake = new Map<string, typeof allTreatments[0]>();
    for (const t of allTreatments ?? []) {
      const existing = mostRecentByIntake.get(t.intake_id);
      if (!existing || new Date(t.treatment_date) > new Date(existing.treatment_date)) {
        mostRecentByIntake.set(t.intake_id, t);
      }
    }

    type CandidateRow = { treatment: typeof allTreatments[0]; intake: typeof eligibleIntakes[0] };
    const sixMonthDue: CandidateRow[] = [];
    const nineMonthDue: CandidateRow[] = [];

    for (const intake of eligibleIntakes) {
      const mostRecent = mostRecentByIntake.get(intake.id);
      if (!mostRecent) continue; // no non-archived treatment at all

      // Backup only: if the procedure has reminder_days, treatment-reminders cron handles it
      if ((mostRecent.procedures as any)?.reminder_days) continue;

      const tDate = new Date(mostRecent.treatment_date);

      // Gate on treatment.reminder_6m_sent_at / reminder_9m_sent_at (not intake flags)
      if (!mostRecent.reminder_6m_sent_at && tDate <= sixMonthsAgo) {
        sixMonthDue.push({ treatment: mostRecent, intake });
      }
      if (!mostRecent.reminder_9m_sent_at && tDate <= nineMonthsAgo) {
        nineMonthDue.push({ treatment: mostRecent, intake });
      }
    }

    for (const { treatment, intake } of sixMonthDue) {
      const nurseId = treatment.nurse_id ?? intake.nurse_id;
      const { data: bot } = await supabase
        .from("bots")
        .select("practice_name, booking_link")
        .eq("nurse_id", nurseId)
        .single();

      if (!bot) {
        await supabase.from("message_log").insert({
          type: "reminder_6m",
          channel: "email",
          nurse_id: nurseId,
          intake_id: intake.id,
          status: "skipped",
          error: "bot config not found",
        }).then(() => {}, () => {});
        failed++;
        continue;
      }

      const result = await sendEmail({
        type: "reminder_6m",
        nurse_id: nurseId,
        intake_id: intake.id,
        treatment_id: treatment.id,
        to: intake.email,
        subject: `${escapeHtml(firstName(intake.first_name, "Beautiful"))}, your lips are calling 💋`,
        html: buildReminderEmail({
          clientName: escapeHtml(firstName(intake.first_name, "Beautiful")),
          practiceName: escapeHtml(bot.practice_name || "your provider"),
          bookingLink: bot.booking_link || null,
          months: 6,
          intakeId: intake.id,
        }),
        supabase,
      });

      if (result.ok) {
        await supabase.from("treatments")
          .update({ reminder_6m_sent_at: new Date().toISOString() })
          .eq("id", treatment.id);
        sent++;
      } else {
        failed++;
      }
    }

    for (const { treatment, intake } of nineMonthDue) {
      const nurseId = treatment.nurse_id ?? intake.nurse_id;
      const { data: bot } = await supabase
        .from("bots")
        .select("practice_name, booking_link")
        .eq("nurse_id", nurseId)
        .single();

      if (!bot) {
        await supabase.from("message_log").insert({
          type: "reminder_9m",
          channel: "email",
          nurse_id: nurseId,
          intake_id: intake.id,
          status: "skipped",
          error: "bot config not found",
        }).then(() => {}, () => {});
        failed++;
        continue;
      }

      const result = await sendEmail({
        type: "reminder_9m",
        nurse_id: nurseId,
        intake_id: intake.id,
        treatment_id: treatment.id,
        to: intake.email,
        subject: `It's been a while, ${escapeHtml(firstName(intake.first_name, "Beautiful"))} — time to glow again ✨`,
        html: buildReminderEmail({
          clientName: escapeHtml(firstName(intake.first_name, "Beautiful")),
          practiceName: escapeHtml(bot.practice_name || "your provider"),
          bookingLink: bot.booking_link || null,
          months: 9,
          intakeId: intake.id,
        }),
        supabase,
      });

      if (result.ok) {
        await supabase.from("treatments")
          .update({ reminder_9m_sent_at: new Date().toISOString() })
          .eq("id", treatment.id);
        sent++;
      } else {
        failed++;
      }
    }

    return NextResponse.json({ success: true, sent });
  } catch (e) {
    console.error("[cron/reminders] unexpected error:", e);
    await logError("cron:reminders", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  } finally {
    await supabase.from("message_log").insert({
      type: "cron:reminders",
      channel: "email",
      status: "sent",
      error: `sent ${sent}, failed ${failed}`,
    }).then(() => {}, () => {});
  }
}

function buildReminderEmail({ clientName, practiceName, bookingLink, months, intakeId }: {
  clientName: string;
  practiceName: string;
  bookingLink: string | null;
  months: number;
  intakeId: string;
}) {
  const is6 = months === 6;
  const headline = is6
    ? `Your results are fading, ${clientName} — and we miss you 💕`
    : `${clientName}, it's been 9 months. Your glow is ready for a refresh ✨`;
  const body1 = is6
    ? `It's been about 6 months since your last appointment at ${practiceName} — which means your filler is naturally starting to soften. This is actually the perfect time to come back for a touch up before it fully fades.`
    : `Nine months in, and your results have done their job beautifully. But the best version of your look? It's one appointment away. Coming back now means your nurse can build on what's already there — not start from scratch.`;
  const body2 = is6
    ? `Most clients say their 6-month touch up is their favorite appointment — it's subtle, quick, and keeps you looking effortlessly fresh. No one will know. They'll just think you look amazing.`
    : `Your lips, cheeks, or wherever you last treated — they're ready. And so are we. Don't let the work fade completely. A small refresh now goes a long way.`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Time to glow again</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
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
            <h1 style="margin:0 0 16px;color:#1a2744;font-size:22px;font-weight:600;line-height:1.3;">${headline}</h1>
            <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">${body1}</p>
            <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.7;">${body2}</p>
            ${bookingLink ? `
            <a href="${bookingLink}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:50px;">
              Book my touch up 💕
            </a>` : `<p style="color:#0d9488;font-size:15px;font-weight:600;">Contact ${practiceName} to book your appointment 💕</p>`}
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0 0 4px;color:#94a3b8;font-size:12px;">Sent with care by ${practiceName} via AdonisBlue</p>
            <p style="margin:0 0 6px;color:#cbd5e1;font-size:11px;">You're receiving this because you visited ${practiceName}.</p>
            <p style="margin:0;color:#cbd5e1;font-size:11px;"><a href="https://www.adonisblue.io/api/unsubscribe?id=${intakeId}" style="color:#cbd5e1;text-decoration:underline;">Unsubscribe from these emails</a></p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
