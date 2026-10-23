import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/sendAndLog";
import { logError } from "@/lib/logError";
import { firstName } from "@/lib/firstName";
import { buildBackupReminderEmail } from "@/lib/emails/returnEmails";
import { returnBookingLink } from "@/lib/returnLink";

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
        .select("practice_name, booking_link, rebooking_link")
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
        html: buildBackupReminderEmail({
          clientName: escapeHtml(firstName(intake.first_name, "Beautiful")),
          practiceName: escapeHtml(bot.practice_name || "your provider"),
          bookingLink: returnBookingLink((bot as any).rebooking_link, bot.booking_link),
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
        .select("practice_name, booking_link, rebooking_link")
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
        html: buildBackupReminderEmail({
          clientName: escapeHtml(firstName(intake.first_name, "Beautiful")),
          practiceName: escapeHtml(bot.practice_name || "your provider"),
          bookingLink: returnBookingLink((bot as any).rebooking_link, bot.booking_link),
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

