import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/sendAndLog";
import { logError } from "@/lib/logError";
import { firstName } from "@/lib/firstName";
import { getClientSender } from "@/lib/clientEmailSender";
import { dueDate, inReminderWindow, DEFAULT_RETURN_DAYS, inPersonalReminderWindow, personalReminderSendDate, formatDueDate } from "@/lib/reminderDate";
import { buildTreatmentReminderEmail, buildPersonalReturnEmail } from "@/lib/emails/returnEmails";
import { returnBookingLink } from "@/lib/returnLink";

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
  let cronError: string | null = null;

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
        planned_return_at,
        return_reason,
        reminder_lead_days,
        planned_reminder_sent_at,
        intakes(first_name, email),
        procedures(name, reminder_days)
      `)
      .eq("reminder_sent", false)
      .is("rebooked_at", null)
      .eq("archived", false);

    if (treatmentsError) {
      cronError = treatmentsError.message;
      await logError("cron:treatment-reminders", treatmentsError.message);
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
      const hasPersonalPlan = treatment.planned_return_at != null && treatment.reminder_lead_days != null;
      const personalAlreadySent = treatment.planned_reminder_sent_at != null;

      // Personal plan: use planned dates; skip default path entirely for this treatment
      if (hasPersonalPlan) {
        if (personalAlreadySent) continue;
        if (!inPersonalReminderWindow(treatment.planned_return_at!, treatment.reminder_lead_days!, todayUTC)) continue;
      } else {
        // Default path
        const reminderDays: number = (treatment.procedures as any)?.reminder_days ?? DEFAULT_RETURN_DAYS;
        const due = dueDate(treatment.treatment_date, reminderDays);
        if (!inReminderWindow(due, todayUTC)) continue;
      }

      const intake = Array.isArray(treatment.intakes) ? treatment.intakes[0] : treatment.intakes;
      if (optOutMap.get(treatment.intake_id)) continue;
      const clientEmail = (intake as any)?.email;
      if (!clientEmail) continue;

      const clientName = escapeHtml(firstName((intake as any)?.first_name, "Beautiful"));
      const procedureName = escapeHtml((treatment.procedures as any)?.name || treatment.procedure_name || "your treatment");

      const { data: bot } = await supabase
        .from("bots")
        .select("practice_name, booking_link, rebooking_link, slug, logo_url, alert_email, alert_email_verified, notification_email")
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
      const bookingLink = returnBookingLink((bot as any).rebooking_link, bot.booking_link);

      let emailHtml: string;
      let emailSubject: string;

      if (hasPersonalPlan) {
        const returnDateStr = formatDueDate(new Date(treatment.planned_return_at! + "T00:00:00Z"));
        const reasonSafe = treatment.return_reason ? escapeHtml(treatment.return_reason) : null;
        emailSubject = reasonSafe
          ? `${reasonSafe} — you can book starting ${returnDateStr} 💙`
          : `You can come back starting ${returnDateStr} 💙`;
        emailHtml = buildPersonalReturnEmail({
          clientName,
          practiceName,
          logoUrl: (bot as any).logo_url ?? null,
          bookingLink,
          returnReason: reasonSafe,
          plannedReturnAt: treatment.planned_return_at!,
          slug: bot.slug ?? null,
          intakeId: treatment.intake_id,
        });
      } else {
        const reminderDays: number = (treatment.procedures as any)?.reminder_days ?? DEFAULT_RETURN_DAYS;
        emailSubject = `Time to refresh your ${procedureName}? ✨`;
        emailHtml = buildTreatmentReminderEmail({
          clientName,
          practiceName,
          logoUrl: (bot as any).logo_url ?? null,
          bookingLink,
          procedureName,
          treatmentDate: treatment.treatment_date,
          reminderDays,
          slug: bot.slug ?? null,
          intakeId: treatment.intake_id,
        });
      }

      const result = await sendEmail({
        type: "treatment_reminder",
        nurse_id: treatment.nurse_id,
        intake_id: treatment.intake_id,
        treatment_id: treatment.id,
        to: clientEmail,
        subject: emailSubject,
        ...getClientSender(bot),
        html: emailHtml,
        supabase,
      });

      if (result.ok) {
        const updateFields: Record<string, unknown> = {
          reminder_sent: true,
          reminder_sent_at: new Date().toISOString(),
        };
        if (hasPersonalPlan) {
          updateFields.planned_reminder_sent_at = new Date().toISOString();
        }
        await supabase
          .from("treatments")
          .update(updateFields)
          .eq("id", treatment.id);
        sentCount++;
      } else {
        failedCount++;
      }
    }

    return NextResponse.json({ sent: sentCount });
  } catch (e) {
    cronError = String(e);
    await logError("cron:treatment-reminders", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  } finally {
    await supabase.from("message_log").insert({
      type: "cron:treatment-reminders",
      channel: "email",
      status: cronError ? "error" : "ok",
      error: cronError ? null : `sent ${sentCount}, failed ${failedCount}`,
      error_message: cronError ?? null,
    }).then(() => {}, () => {});
  }
}

