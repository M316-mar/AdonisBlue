import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { logError } from "@/lib/logError";
import { dueDate } from "@/lib/reminderDate";
import { formatTreatmentDate } from "@/lib/formatTreatmentDate";
import { buildNurseReturnEmail } from "@/lib/emails/returnEmails";

const resend = new Resend(process.env.RESEND_API_KEY);

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

      const formattedClients = clients.map((c) => ({
        clientName: c.clientName,
        procedureName: c.procedureName,
        dueFormatted: formatTreatmentDate(c.dueISO, { month: "long", day: "numeric" }),
      }));

      const html = buildNurseReturnEmail({ practiceName, clients: formattedClients });

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
