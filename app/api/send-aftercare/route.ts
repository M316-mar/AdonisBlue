import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logError";
import { firstName } from "@/lib/firstName";
import { substitutePlaceholdersSafeHtml } from "@/lib/substitutePlaceholders";
import { buildAftercareEmail, escapeHtml } from "@/lib/buildAftercareEmail";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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
    const instrHtml = substitutePlaceholdersSafeHtml(rawPreviewInstructions, previewNurseName, previewNursePhone);
    const nurseFirst = previewNurseName.split(/\s+/)[0] || previewNurseName || "your nurse";

    let contentWithNote = instrHtml;
    if (personalNote) {
      contentWithNote += `\n<div style="background:#fff7ed;border-radius:14px;padding:20px;margin:16px 0;border-left:4px solid #f97316;"><h3 style="margin:0 0 10px;color:#c2410c;font-size:15px;font-weight:600;">&#128172; A note just for you</h3><p style="margin:0;color:#1a2744;font-size:14px;line-height:1.75;white-space:pre-wrap;">${escapeHtml(personalNote)}</p></div>`;
    }

    const html = buildAftercareEmail({
      clientFirstName: firstName(intake.first_name, ""),
      escapedPracticeName: escapeHtml(bot?.practice_name || "your provider"),
      treatmentId: "preview",
      procedures: [{ name: procedure.name, contentHtml: contentWithNote, tabParam: encodeURIComponent(procedure.name) }],
      nurseFirstName: nurseFirst,
      nursePhone: previewNursePhone,
      siteUrl: SITE_URL,
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

      // Dedup: already sent or already scheduled?
      const alreadySentAt = (t as any).aftercare_sent_at as string | null;
      const alreadyScheduledAt = (t as any).aftercare_send_at as string | null;
      if (alreadySentAt) {
        return NextResponse.json({ already_sent: true, sent_at: alreadySentAt }, { status: 409 });
      }
      if (alreadyScheduledAt && new Date(alreadyScheduledAt) > new Date()) {
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

      const aftercareSendAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const { error: updateErr } = await supabase.from("treatments").update({ aftercare_send_at: aftercareSendAt, aftercare_canceled_at: null }).eq("id", treatmentIdDirect);
      if (updateErr) {
        await logError("send-aftercare", `aftercare_send_at update: ${updateErr.message}`);
        return NextResponse.json({ error: "Failed to schedule aftercare — please try again" }, { status: 500 });
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

    const aftercareSendAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: updateErr } = await supabase
      .from("treatments")
      .update({ aftercare_send_at: aftercareSendAt, aftercare_canceled_at: null })
      .eq("id", treatmentId);
    if (updateErr) {
      await logError("send-aftercare", `aftercare_send_at update: ${updateErr.message}`);
      return NextResponse.json({ error: "Failed to schedule aftercare — please try again" }, { status: 500 });
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

