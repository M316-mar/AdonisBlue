import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logError";
import { sendEmail } from "@/lib/sendAndLog";
import { getClientSender } from "@/lib/clientEmailSender";
import { firstName } from "@/lib/firstName";
import { substitutePlaceholdersSafeHtml } from "@/lib/substitutePlaceholders";
import { buildAftercareEmail, escapeHtml } from "@/lib/buildAftercareEmail";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date().toISOString();
  const staleClaimBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  // Fetch treatments that are due, not yet sent, and not currently being claimed
  const { data: due, error: fetchErr } = await supabase
    .from("treatments")
    .select("id, nurse_id, intake_id, procedure_id, procedure_name")
    .lte("aftercare_send_at", now)
    .is("aftercare_sent_at", null)
    .is("aftercare_canceled_at", null)
    .or(`aftercare_claimed_at.is.null,aftercare_claimed_at.lt.${staleClaimBefore}`)
    .eq("archived", false)
    .limit(50);

  if (fetchErr) {
    await logError("cron:send-due-aftercare", `fetch: ${fetchErr.message}`);
    return NextResponse.json({ error: "DB fetch failed" }, { status: 500 });
  }

  if (!due || due.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  // Batch-fetch junction procedure rows and their instructions
  const treatmentIds = due.map((t) => t.id);
  const { data: junctionRowsBatch } = await supabase
    .from("treatment_procedures")
    .select("treatment_id, procedure_id, procedure_name, sort_order")
    .in("treatment_id", treatmentIds)
    .order("sort_order", { ascending: true });
  const neededProcIds = new Set<string>();
  for (const r of junctionRowsBatch ?? []) neededProcIds.add(r.procedure_id);
  for (const t of due) {
    if (!(junctionRowsBatch ?? []).some((r) => r.treatment_id === t.id) && t.procedure_id) {
      neededProcIds.add(t.procedure_id);
    }
  }
  const { data: procsBatch } = neededProcIds.size > 0
    ? await supabase.from("procedures").select("id, name, aftercare_instructions").in("id", [...neededProcIds])
    : { data: [] as Array<{ id: string; name: string; aftercare_instructions: string }> };
  const procsMap = new Map((procsBatch ?? []).map((p) => [p.id, p]));
  const junctionByTreatment = new Map<string, Array<{ procedure_id: string; procedure_name: string }>>();
  for (const r of junctionRowsBatch ?? []) {
    if (!junctionByTreatment.has(r.treatment_id)) junctionByTreatment.set(r.treatment_id, []);
    junctionByTreatment.get(r.treatment_id)!.push(r);
  }

  for (const treatment of due) {
    // Atomic claim — only one worker can own a row at a time
    const claimAt = new Date().toISOString();
    const { data: claimed, error: claimErr } = await supabase
      .from("treatments")
      .update({ aftercare_claimed_at: claimAt })
      .eq("id", treatment.id)
      .is("aftercare_sent_at", null)
      .or(`aftercare_claimed_at.is.null,aftercare_claimed_at.lt.${staleClaimBefore}`)
      .select("id")
      .maybeSingle();

    if (claimErr) {
      await logError("cron:send-due-aftercare", `claim ${treatment.id}: ${claimErr.message}`);
      skipped++;
      continue;
    }
    if (!claimed) {
      // Another worker claimed this row between the fetch and the UPDATE
      skipped++;
      continue;
    }

    // Fetch related data needed to build the email
    const [intakeRes, botRes] = await Promise.all([
      treatment.intake_id
        ? supabase.from("intakes").select("first_name, email").eq("id", treatment.intake_id).single()
        : Promise.resolve({ data: null, error: null }),
      supabase.from("bots").select("practice_name, nurse_name, alert_phone, phone_public, alert_email, alert_email_verified, notification_email").eq("nurse_id", treatment.nurse_id).single(),
    ]);

    const intake = intakeRes.data;
    const bot = botRes.data;

    if (!intake?.email) {
      // No email — clear claim so it doesn't block future runs, mark as not sendable
      await supabase.from("treatments").update({ aftercare_claimed_at: null, aftercare_send_at: null }).eq("id", treatment.id);
      await logError("cron:send-due-aftercare", `no email for treatment ${treatment.id}`);
      skipped++;
      continue;
    }

    const practiceName = bot?.practice_name || "your provider";
    const nurseDisplayName = bot?.nurse_name || bot?.practice_name || "";
    const nursePhone = bot?.phone_public || bot?.alert_phone || "";
    const clientName = firstName(intake.first_name, "beautiful");

    // Resolve all procedures for this treatment
    const jProcs = junctionByTreatment.get(treatment.id) ?? [];
    const allProcedures: Array<{ procedure_id: string; name: string; aftercare_instructions: string }> =
      jProcs.length > 0
        ? jProcs.map((jp) => ({
            procedure_id: jp.procedure_id,
            name: procsMap.get(jp.procedure_id)?.name || jp.procedure_name,
            aftercare_instructions: procsMap.get(jp.procedure_id)?.aftercare_instructions ?? "",
          }))
        : treatment.procedure_id
        ? [{
            procedure_id: treatment.procedure_id,
            name: procsMap.get(treatment.procedure_id)?.name || treatment.procedure_name || "your treatment",
            aftercare_instructions: procsMap.get(treatment.procedure_id)?.aftercare_instructions ?? "",
          }]
        : treatment.procedure_name
        ? [{ procedure_id: "", name: treatment.procedure_name, aftercare_instructions: "" }]
        : [];

    // Build one content entry per procedure; skip empty instructions (log + to-do)
    const emailProcs: Array<{ name: string; contentHtml: string; tabParam: string }> = [];
    for (const ap of allProcedures) {
      const rawInstr = (ap.aftercare_instructions ?? "").trim();
      if (!rawInstr) {
        await logError("cron:send-due-aftercare", `procedure "${ap.name}" has no aftercare for treatment ${treatment.id}`);
        const { error: todoErr } = await supabase.from("message_log").insert({
          type: "action_needed",
          channel: "nurse",
          nurse_id: treatment.nurse_id,
          treatment_id: treatment.id,
          intake_id: treatment.intake_id,
          status: "pending",
          error: `Aftercare for ${ap.name} is empty, so ${intake.first_name || "your client"} didn't get instructions for it.`,
        });
        if (todoErr) await logError("cron:send-due-aftercare", `action_needed insert failed: ${todoErr.message}`);
        continue;
      }
      const instrHtml = substitutePlaceholdersSafeHtml(rawInstr, nurseDisplayName, nursePhone);
      emailProcs.push({
        name: ap.name,
        contentHtml: instrHtml,
        tabParam: encodeURIComponent(ap.name),
      });
    }

    if (emailProcs.length === 0) {
      // All procedures had empty aftercare — to-dos logged above; mark un-sendable
      await supabase.from("treatments").update({ aftercare_claimed_at: null, aftercare_send_at: null }).eq("id", treatment.id);
      skipped++;
      continue;
    }

    const nurseFirst = nurseDisplayName.split(/\s+/)[0] || nurseDisplayName || "your nurse";
    const html = buildAftercareEmail({
      clientFirstName: firstName(intake.first_name, ""),
      escapedPracticeName: escapeHtml(practiceName),
      treatmentId: treatment.id,
      procedures: emailProcs,
      nurseFirstName: nurseFirst,
      nursePhone,
      siteUrl: SITE_URL,
    });

    const { from_name, reply_to } = getClientSender(bot ?? {});
    const result = await sendEmail({
      type: "aftercare",
      nurse_id: treatment.nurse_id,
      treatment_id: treatment.id,
      intake_id: treatment.intake_id,
      to: intake.email,
      subject: `Your aftercare instructions from ${practiceName} 💙`,
      html,
      supabase,
      from_name,
      reply_to,
    });

    if (!result.ok) {
      // Clear claim so the next run retries, but leave aftercare_send_at intact
      await supabase.from("treatments").update({ aftercare_claimed_at: null }).eq("id", treatment.id);
      await logError("cron:send-due-aftercare", `send failed for ${treatment.id}: ${result.error}`);
      failed++;
      continue;
    }

    const sentAt = new Date().toISOString();
    const { error: markErr } = await supabase
      .from("treatments")
      .update({
        aftercare_sent: true,
        aftercare_sent_at: sentAt,
        aftercare_send_at: null,
        aftercare_claimed_at: null,
      })
      .eq("id", treatment.id);

    if (markErr) {
      await logError("cron:send-due-aftercare", `mark-sent ${treatment.id}: ${markErr.message}`);
    }

    if (treatment.intake_id) {
      await supabase.from("intakes").update({ aftercare_sent_at: sentAt }).eq("id", treatment.intake_id);
    }

    sent++;
  }

  return NextResponse.json({ ok: true, sent, skipped, failed });
}
