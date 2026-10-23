import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail, scheduleEmail } from "@/lib/sendAndLog";
import { logError } from "@/lib/logError";
import { firstName } from "@/lib/firstName";
import { substitutePlaceholdersSafeHtml } from "@/lib/substitutePlaceholders";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Shared HTML builder — used by both the real send and the preview endpoint
function buildAftercareHtml({
  clientName,
  escapedPracticeName,
  treatmentId,
  procedureName,
  instructions,
  personalNote,
}: {
  clientName: string;
  escapedPracticeName: string;
  treatmentId: string;
  procedureName: string;
  instructions: string;
  personalNote: string;
}): string {
  let combinedHtml = `
<div style="background:#f0fdf4;border-radius:14px;padding:20px;margin:16px 0;border-left:4px solid #0d9488;">
  <h3 style="margin:0 0 10px;color:#0d9488;font-size:15px;font-weight:600;">📋 ${escapeHtml(procedureName)} Aftercare</h3>
  <p style="margin:0;color:#1a2744;font-size:14px;line-height:1.75;white-space:pre-wrap;">${instructions}</p>
</div>`;
  if (personalNote) {
    combinedHtml += `
<div style="background:#fff7ed;border-radius:14px;padding:20px;margin:16px 0;border-left:4px solid #f97316;">
  <h3 style="margin:0 0 10px;color:#c2410c;font-size:15px;font-weight:600;">💬 A note just for you</h3>
  <p style="margin:0;color:#1a2744;font-size:14px;line-height:1.75;white-space:pre-wrap;">${escapeHtml(personalNote)}</p>
</div>`;
  }
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#1a2744;padding:28px 32px;text-align:center;">
          <img src="${SITE_URL}/Alona.png" alt="AdonisBlue" width="44" height="44" style="border-radius:10px;display:block;margin:0 auto 10px;" />
          <span style="color:#fff;font-size:18px;font-weight:600;">${escapedPracticeName}</span>
        </td></tr>
        <tr><td style="padding:36px 32px;">
          <h1 style="margin:0 0 8px;color:#1a2744;font-size:22px;font-weight:600;">You're glowing, ${clientName}! 🌸</h1>
          <p style="margin:0 0 8px;color:#475569;font-size:14px;">Thank you for your visit. Here are your aftercare instructions:</p>
          ${combinedHtml}
          <div style="background:#1a2744;border-radius:14px;padding:20px;margin:20px 0;text-align:center;">
            <p style="margin:0 0 8px;color:#ffffff;font-size:15px;font-weight:600;">Have recovery questions? 💙</p>
            <p style="margin:0 0 12px;color:#94a3b8;font-size:13px;">Our 24/7 recovery chat is here for you.</p>
            <a href="${SITE_URL}/healing/${treatmentId}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:50px;">💬 Open recovery chat</a>
          </div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">Sent with care by ${escapedPracticeName} via AdonisBlue</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// GET /api/send-aftercare?procedure_id=X&intake_id=Y&personal_note=Z
// Returns { html } — the exact email that would be sent, without sending.
export async function GET(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    const procedureIdRaw = (searchParams.get("procedure_id") ?? "").trim();
    const intakeIdRaw = (searchParams.get("intake_id") ?? "").trim();
    const personalNote = (searchParams.get("personal_note") ?? "").trim().slice(0, 1000);

    if (!procedureIdRaw || !UUID_REGEX.test(procedureIdRaw)) {
      return NextResponse.json({ error: "Invalid procedure ID" }, { status: 400 });
    }
    if (!intakeIdRaw || !UUID_REGEX.test(intakeIdRaw)) {
      return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });
    }

    const [{ data: procedure }, { data: intake }, { data: bot }] = await Promise.all([
      supabase.from("procedures").select("id, name, aftercare_instructions, approved_at").eq("id", procedureIdRaw).eq("nurse_id", user.id).maybeSingle(),
      supabase.from("intakes").select("id, first_name").eq("id", intakeIdRaw).eq("nurse_id", user.id).maybeSingle(),
      supabase.from("bots").select("practice_name, nurse_name, alert_phone, phone_public").eq("nurse_id", user.id).single(),
    ]);

    if (!procedure || !intake) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const previewNurseName = bot?.nurse_name || bot?.practice_name || "";
    const previewNursePhone = bot?.phone_public || bot?.alert_phone || "";
    const rawPreviewInstructions = (procedure.aftercare_instructions ?? "").trim() || "Take it easy, stay hydrated, and avoid strenuous activity for 24 hours.";

    const html = buildAftercareHtml({
      clientName: escapeHtml(firstName(intake.first_name, "Beautiful")),
      escapedPracticeName: escapeHtml(bot?.practice_name || "your provider"),
      treatmentId: "preview",
      procedureName: procedure.name,
      instructions: substitutePlaceholdersSafeHtml(rawPreviewInstructions, previewNurseName, previewNursePhone),
      personalNote,
    });

    return NextResponse.json({ html });
  } catch (e) {
    console.error("[send-aftercare preview]", e);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();

    const personalNote = typeof body.personal_note === "string" ? body.personal_note.trim().slice(0, 1000) : "";

    // ── Path A: treatment_id supplied — send for that exact treatment ─────────
    const treatmentIdDirect = typeof body.treatment_id === "string" ? body.treatment_id.trim() : "";
    if (treatmentIdDirect && UUID_REGEX.test(treatmentIdDirect)) {
      const { data: t } = await supabase
        .from("treatments")
        .select("id, intake_id, procedure_id, procedure_name, treatment_date, aftercare_sent_at, aftercare_send_at, archived")
        .eq("id", treatmentIdDirect)
        .eq("nurse_id", user.id)
        .maybeSingle();

      if (!t) return NextResponse.json({ error: "Treatment not found" }, { status: 404 });
      if (t.archived) return NextResponse.json({ error: "Treatment is archived" }, { status: 422 });

      const sendNow = body.send_now === true;
      // Dedup: already sent or already scheduled?
      const alreadySentAt = (t as any).aftercare_sent_at as string | null;
      const alreadyScheduledAt = (t as any).aftercare_send_at as string | null;
      if (alreadySentAt) {
        return NextResponse.json({ already_sent: true, sent_at: alreadySentAt }, { status: 409 });
      }
      // When send_now=true (nurse clicked "Send now" on a scheduled row), skip the
      // scheduled-dedup guard so we can send immediately instead of waiting.
      if (!sendNow && alreadyScheduledAt && new Date(alreadyScheduledAt) > new Date()) {
        return NextResponse.json({ already_scheduled: true, scheduled_at: alreadyScheduledAt }, { status: 409 });
      }

      const procedureIdForPath = (t as any).procedure_id as string | null;
      if (!procedureIdForPath || !UUID_REGEX.test(procedureIdForPath)) {
        return NextResponse.json({ error: "Treatment has no linked procedure — open the Emails page to send manually" }, { status: 422 });
      }

      const [{ data: procedure }, { data: intake }] = await Promise.all([
        supabase.from("procedures").select("id, name, aftercare_instructions, reminder_days, approved_at").eq("id", procedureIdForPath).eq("nurse_id", user.id).maybeSingle(),
        supabase.from("intakes").select("id, first_name, email, nurse_id, marketing_opt_out, review_submitted_at, review_request_sent").eq("id", (t as any).intake_id).eq("nurse_id", user.id).maybeSingle(),
      ]);

      if (!procedure) return NextResponse.json({ error: "Procedure not found" }, { status: 404 });
      if (!procedure.approved_at) return NextResponse.json({ error: "You need to approve this aftercare before sending it" }, { status: 422 });
      if (!intake) return NextResponse.json({ error: "Client not found" }, { status: 404 });
      if (!intake.email) return NextResponse.json({ error: "This client doesn't have an email address on file" }, { status: 422 });

      const { data: bot } = await supabase.from("bots").select("practice_name, nurse_name, alert_phone, phone_public").eq("nurse_id", user.id).single();
      const sendNurseName = bot?.nurse_name || bot?.practice_name || "";
      const sendNursePhone = bot?.phone_public || bot?.alert_phone || "";
      const rawInstr = (procedure.aftercare_instructions ?? "").trim() || "Take it easy, stay hydrated, and avoid strenuous activity for 24 hours.";
      const instructions = substitutePlaceholdersSafeHtml(rawInstr, sendNurseName, sendNursePhone);
      const clientName = escapeHtml(firstName(intake.first_name, "Beautiful"));
      const emailHtml = buildAftercareHtml({ clientName, escapedPracticeName: escapeHtml(bot?.practice_name || "your provider"), treatmentId: treatmentIdDirect, procedureName: procedure.name, instructions, personalNote });
      const emailSubject = `Your aftercare instructions from ${escapeHtml(bot?.practice_name || "your provider")} 💙`;
      let aftercareSendAt: string | null = null;

      if (sendNow) {
        // Nurse clicked "Send now" — skip schedule, send immediately
        const immediateResult = await sendEmail({ type: "aftercare", nurse_id: user.id, treatment_id: treatmentIdDirect, intake_id: (t as any).intake_id, to: intake.email, subject: emailSubject, html: emailHtml, supabase });
        if (!immediateResult.ok) return NextResponse.json({ error: "Failed to send aftercare email — please try again" }, { status: 500 });
        const sentAt = new Date().toISOString();
        await supabase.from("treatments").update({ aftercare_sent: true, aftercare_sent_at: sentAt, aftercare_send_at: null }).eq("id", treatmentIdDirect);
        await supabase.from("intakes").update({ aftercare_sent_at: sentAt }).eq("id", (t as any).intake_id);
      } else {
        const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        const scheduleResult = await scheduleEmail({ type: "aftercare", nurse_id: user.id, treatment_id: treatmentIdDirect, intake_id: (t as any).intake_id, to: intake.email, subject: emailSubject, html: emailHtml, scheduledAt, supabase });
        if (scheduleResult.ok) {
          await supabase.from("treatments").update({ aftercare_send_at: scheduledAt }).eq("id", treatmentIdDirect);
          aftercareSendAt = scheduledAt;
        } else {
          await logError("send-aftercare", `schedule failed, sending immediately: ${scheduleResult.error}`);
          const fallbackResult = await sendEmail({ type: "aftercare", nurse_id: user.id, treatment_id: treatmentIdDirect, intake_id: (t as any).intake_id, to: intake.email, subject: emailSubject, html: emailHtml, supabase });
          if (!fallbackResult.ok) return NextResponse.json({ error: "Failed to send aftercare email — please try again" }, { status: 500 });
          const sentAt = new Date().toISOString();
          await supabase.from("treatments").update({ aftercare_sent: true, aftercare_sent_at: sentAt }).eq("id", treatmentIdDirect);
          await supabase.from("intakes").update({ aftercare_sent_at: sentAt }).eq("id", (t as any).intake_id);
        }
      }

      return NextResponse.json({ success: true, treatment_id: treatmentIdDirect, treatment_date: (t as any).treatment_date, aftercare_send_at: aftercareSendAt, procedure_name: procedure.name, reminder_days: procedure.reminder_days ?? null, client_name: intake.first_name || "Beautiful", marketing_opt_out: intake.marketing_opt_out ?? false, review_submitted_at: intake.review_submitted_at ?? null, review_request_sent: intake.review_request_sent ?? false });
    }

    // ── Path B: intake_id + procedure_id + treatment_date (legacy / client-journey modal) ──
    const intakeIdRaw = typeof body.intake_id === "string" ? body.intake_id.trim() : "";
    if (!intakeIdRaw || !UUID_REGEX.test(intakeIdRaw)) {
      return NextResponse.json({ error: "Invalid client ID" }, { status: 400 });
    }

    const procedureIdRaw = typeof body.procedure_id === "string" ? body.procedure_id.trim() : "";
    if (!procedureIdRaw || !UUID_REGEX.test(procedureIdRaw)) {
      return NextResponse.json({ error: "Please select a treatment" }, { status: 400 });
    }

    const treatmentDateRaw = typeof body.treatment_date === "string" ? body.treatment_date.trim() : "";
    if (!treatmentDateRaw || !DATE_REGEX.test(treatmentDateRaw) || isNaN(Date.parse(treatmentDateRaw))) {
      return NextResponse.json({ error: "Invalid treatment date" }, { status: 400 });
    }
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    if (new Date(treatmentDateRaw + "T00:00:00Z") > todayEnd) {
      return NextResponse.json({ error: "Treatment date cannot be in the future" }, { status: 400 });
    }

    // Load procedure — must belong to this nurse and be approved
    const { data: procedure } = await supabase
      .from("procedures")
      .select("id, name, aftercare_instructions, reminder_days, approved_at")
      .eq("id", procedureIdRaw)
      .eq("nurse_id", user.id)
      .maybeSingle();

    if (!procedure) {
      return NextResponse.json({ error: "Treatment not found" }, { status: 404 });
    }
    if (!procedure.approved_at) {
      return NextResponse.json({ error: "You need to approve this aftercare before sending it" }, { status: 422 });
    }

    // Load intake — must belong to this nurse
    const { data: intake } = await supabase
      .from("intakes")
      .select("id, first_name, email, nurse_id, marketing_opt_out, review_submitted_at, review_request_sent")
      .eq("id", intakeIdRaw)
      .eq("nurse_id", user.id)
      .maybeSingle();

    if (!intake) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }
    if (!intake.email) {
      return NextResponse.json({ error: "This client doesn't have an email address on file" }, { status: 422 });
    }

    // Create or reuse treatment record — find by intake+procedure+date, exactly one row
    const { data: existing, error: existingErr } = await supabase
      .from("treatments")
      .select("id, aftercare_sent_at, aftercare_send_at")
      .eq("intake_id", intakeIdRaw)
      .eq("procedure_id", procedureIdRaw)
      .eq("treatment_date", treatmentDateRaw)
      .eq("archived", false)
      .maybeSingle();

    let treatmentId: string;

    if (existingErr) {
      // Multiple rows matched — can't safely reuse; create a new one
      await logError("send-aftercare", `maybeSingle conflict: ${existingErr.message}`);
    }

    if (existing) {
      // Dedup: already sent or already scheduled?
      const alreadySentAt = (existing as any).aftercare_sent_at as string | null;
      const alreadyScheduledAt = (existing as any).aftercare_send_at as string | null;
      if (alreadySentAt) {
        return NextResponse.json({ already_sent: true, sent_at: alreadySentAt }, { status: 409 });
      }
      if (alreadyScheduledAt && new Date(alreadyScheduledAt) > new Date()) {
        return NextResponse.json({ already_scheduled: true, scheduled_at: alreadyScheduledAt }, { status: 409 });
      }
      treatmentId = existing.id;
    } else {
      const { data: newT, error: insertErr } = await supabase
        .from("treatments")
        .insert({
          nurse_id: user.id,
          intake_id: intakeIdRaw,
          procedure_id: procedureIdRaw,
          procedure_name: procedure.name,
          treatment_date: treatmentDateRaw,
          archived: false,
        })
        .select("id")
        .single();
      if (insertErr || !newT) {
        return NextResponse.json({ error: "Failed to save visit record" }, { status: 500 });
      }
      treatmentId = newT.id;
    }

    const { data: bot } = await supabase
      .from("bots")
      .select("practice_name, nurse_name, alert_phone, phone_public")
      .eq("nurse_id", user.id)
      .single();

    const practiceName = bot?.practice_name || "your provider";
    const sendNurseName = bot?.nurse_name || bot?.practice_name || "";
    const sendNursePhone = bot?.phone_public || bot?.alert_phone || "";
    const rawSendInstructions = (procedure.aftercare_instructions ?? "").trim()
      || "Take it easy, stay hydrated, and avoid strenuous activity for 24 hours.";
    const instructions = substitutePlaceholdersSafeHtml(rawSendInstructions, sendNurseName, sendNursePhone);

    const clientName = escapeHtml(firstName(intake.first_name, "Beautiful"));
    const escapedPracticeName = escapeHtml(practiceName);

    const emailHtml = buildAftercareHtml({
      clientName,
      escapedPracticeName,
      treatmentId,
      procedureName: procedure.name,
      instructions,
      personalNote,
    });

    const emailSubject = `Your aftercare instructions from ${escapedPracticeName} 💙`;
    const scheduledAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const scheduleResult = await scheduleEmail({
      type: "aftercare",
      nurse_id: user.id,
      treatment_id: treatmentId,
      intake_id: intakeIdRaw,
      to: intake.email,
      subject: emailSubject,
      html: emailHtml,
      scheduledAt,
      supabase,
    });

    let aftercareSendAt: string | null = null;

    if (scheduleResult.ok) {
      const { error: updateErr } = await supabase
        .from("treatments")
        .update({ aftercare_send_at: scheduledAt })
        .eq("id", treatmentId);
      if (updateErr) await logError("send-aftercare", `aftercare_send_at update: ${updateErr.message}`);
      aftercareSendAt = scheduledAt;
    } else {
      await logError("send-aftercare", `schedule failed, sending immediately: ${scheduleResult.error}`);
      const fallbackResult = await sendEmail({
        type: "aftercare",
        nurse_id: user.id,
        treatment_id: treatmentId,
        intake_id: intakeIdRaw,
        to: intake.email,
        subject: emailSubject,
        html: emailHtml,
        supabase,
      });
      if (!fallbackResult.ok) {
        return NextResponse.json({ error: "Failed to send aftercare email — please try again" }, { status: 500 });
      }
      const sentAt = new Date().toISOString();
      await supabase
        .from("treatments")
        .update({ aftercare_sent: true, aftercare_sent_at: sentAt })
        .eq("id", treatmentId);
      await supabase
        .from("intakes")
        .update({ aftercare_sent_at: sentAt })
        .eq("id", intakeIdRaw);
    }

    return NextResponse.json({
      success: true,
      treatment_id: treatmentId,
      treatment_date: treatmentDateRaw,
      aftercare_send_at: aftercareSendAt,
      procedure_name: procedure.name,
      reminder_days: procedure.reminder_days ?? null,
      client_name: intake.first_name || "Beautiful",
      marketing_opt_out: intake.marketing_opt_out ?? false,
      review_submitted_at: intake.review_submitted_at ?? null,
      review_request_sent: intake.review_request_sent ?? false,
    });
  } catch (e) {
    console.error("[send-aftercare]", e);
    await logError("send-aftercare", String(e));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// DELETE /api/send-aftercare — cancel a scheduled aftercare (clears aftercare_send_at)
export async function DELETE(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "").trim();
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const body = await request.json();
    const treatmentId = typeof body.treatment_id === "string" ? body.treatment_id.trim() : "";
    if (!treatmentId || !UUID_REGEX.test(treatmentId)) {
      return NextResponse.json({ error: "Invalid treatment ID" }, { status: 400 });
    }

    const { data: t } = await supabase
      .from("treatments")
      .select("id, aftercare_sent_at")
      .eq("id", treatmentId)
      .eq("nurse_id", user.id)
      .maybeSingle();

    if (!t) return NextResponse.json({ error: "Treatment not found" }, { status: 404 });
    if ((t as any).aftercare_sent_at) {
      return NextResponse.json({ error: "Aftercare has already been sent — cannot cancel" }, { status: 409 });
    }

    const { error: updateErr } = await supabase
      .from("treatments")
      .update({ aftercare_send_at: null })
      .eq("id", treatmentId);

    if (updateErr) {
      await logError("send-aftercare", `cancel update: ${updateErr.message}`);
      return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[send-aftercare DELETE]", e);
    await logError("send-aftercare", String(e));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
