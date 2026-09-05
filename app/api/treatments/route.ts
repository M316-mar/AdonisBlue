import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[0-9\s\+\-\(\)]{7,20}$/;
// ISO date: YYYY-MM-DD
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getAuthToken(request: Request): string | null {
  return request.headers.get("authorization")?.replace("Bearer ", "").trim() || null;
}

async function getAuthUser(token: string) {
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await supabaseAuth.auth.getUser(token);
  return user;
}

export async function GET(request: Request) {
  try {
    const token = getAuthToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getAuthUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);
    // Default: show active (not archived). Pass ?archived=true to fetch archived records.
    const showArchived = searchParams.get("archived") === "true";

    const { data: treatments } = await supabase
      .from("treatments")
      .select("*, intakes(first_name, email, phone, service_interested, prep_guide_sent, followup_sent)")
      .eq("nurse_id", user.id)
      .eq("archived", showArchived)
      .order("created_at", { ascending: false });

    return NextResponse.json({ treatments: treatments ?? [] });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const token = getAuthToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getAuthUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();

    // ── Validate treatment_date ────────────────────────────────────────────
    const treatmentDate = typeof body.treatment_date === "string" ? body.treatment_date.trim() : "";
    if (!treatmentDate || !DATE_REGEX.test(treatmentDate) || isNaN(Date.parse(treatmentDate))) {
      return NextResponse.json({ error: "Invalid treatment date" }, { status: 400 });
    }

    // ── Validate procedure_ids ─────────────────────────────────────────────
    const procedureIds: string[] = Array.isArray(body.procedure_ids)
      ? body.procedure_ids.filter((id: unknown) => typeof id === "string" && UUID_REGEX.test(id))
      : [];

    // ── Validate optional intake_id ────────────────────────────────────────
    const intakeIdRaw = typeof body.intake_id === "string" ? body.intake_id.trim() : "";
    const intakeId = intakeIdRaw && UUID_REGEX.test(intakeIdRaw) ? intakeIdRaw : null;

    // ── Validate optional procedure_id ─────────────────────────────────────
    const procedureIdRaw = typeof body.procedure_id === "string" ? body.procedure_id.trim() : "";
    const procedureId = procedureIdRaw && UUID_REGEX.test(procedureIdRaw) ? procedureIdRaw : null;

    // ── Sanitise text fields ───────────────────────────────────────────────
    const procedureName = typeof body.procedure_name === "string"
      ? body.procedure_name.trim().slice(0, 200)
      : "";
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
    const isWalkin = body.is_walkin === true;
    const sendAftercare = body.send_aftercare !== false; // default true
    const cameViaBot = body.came_via_bot === true;

    // ── Walk-in validation ─────────────────────────────────────────────────
    const walkinName = typeof body.walkin_name === "string" ? body.walkin_name.trim().slice(0, 100) : "";
    const walkinEmailRaw = typeof body.walkin_email === "string" ? body.walkin_email.trim() : "";
    const walkinPhoneRaw = typeof body.walkin_phone === "string" ? body.walkin_phone.trim() : "";

    if (isWalkin && !walkinName) {
      return NextResponse.json({ error: "Walk-in client name is required" }, { status: 400 });
    }
    if (walkinEmailRaw && !EMAIL_REGEX.test(walkinEmailRaw)) {
      return NextResponse.json({ error: "Invalid walk-in email address" }, { status: 400 });
    }
    if (walkinEmailRaw.length > 254) {
      return NextResponse.json({ error: "Walk-in email address too long" }, { status: 400 });
    }
    if (walkinPhoneRaw && !PHONE_REGEX.test(walkinPhoneRaw)) {
      return NextResponse.json({ error: "Invalid walk-in phone number" }, { status: 400 });
    }

    const walkinEmail = walkinEmailRaw ? walkinEmailRaw.toLowerCase() : null;
    const walkinPhone = walkinPhoneRaw || null;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Hard block: never allow "send aftercare" for a procedure that hasn't been approved.
    // This must happen before the treatment is inserted — the client-side check is a courtesy, not a guarantee.
    if (sendAftercare) {
      const earlyProcedureIds: string[] = Array.isArray(body.procedure_ids)
        ? body.procedure_ids.filter((id: unknown) => typeof id === "string" && UUID_REGEX.test(id))
        : (typeof body.procedure_id === "string" && UUID_REGEX.test(body.procedure_id) ? [body.procedure_id] : []);

      if (earlyProcedureIds.length > 0) {
        const { data: approvalCheck } = await supabase
          .from("procedures")
          .select("id, name, approved_at")
          .in("id", earlyProcedureIds);
        const unapproved = (approvalCheck ?? []).filter((p) => !p.approved_at);
        if (unapproved.length > 0) {
          return NextResponse.json(
            { error: "unapproved_procedures", procedures: unapproved.map((p) => p.name) },
            { status: 422 }
          );
        }
      }
    }

    // ── Handle walk-in — create intake first ───────────────────────────────
    let resolvedIntakeId = intakeId;
    let clientEmail: string | null = null;
    let clientName: string | null = null;
    let clientPhone: string | null = null;

    if (isWalkin && walkinName) {
      // Check for an existing client (by email/phone AND matching name) before creating a new folder.
      // Same email but a different name (e.g. a family member) must NOT be merged.
      const normalizedWalkinName = walkinName.trim().toLowerCase();
      let existingIntake: { id: string; first_name: string; email: string | null; phone: string | null } | null = null;
      if (walkinEmail) {
        const { data } = await supabase
          .from("intakes")
          .select("id, first_name, email, phone")
          .eq("nurse_id", user.id)
          .eq("email", walkinEmail);
        existingIntake = (data ?? []).find((i) => i.first_name?.trim().toLowerCase() === normalizedWalkinName) ?? null;
      }
      if (!existingIntake && walkinPhone) {
        const { data } = await supabase
          .from("intakes")
          .select("id, first_name, email, phone")
          .eq("nurse_id", user.id)
          .eq("phone", walkinPhone);
        existingIntake = (data ?? []).find((i) => i.first_name?.trim().toLowerCase() === normalizedWalkinName) ?? null;
      }

      if (existingIntake) {
        resolvedIntakeId = existingIntake.id;
        clientEmail = existingIntake.email ?? walkinEmail;
        clientName = existingIntake.first_name ?? walkinName;
        clientPhone = existingIntake.phone ?? walkinPhone;
      } else {
        const { data: newIntake } = await supabase
          .from("intakes")
          .insert({
            nurse_id: user.id,
            first_name: walkinName,
            email: walkinEmail,
            phone: walkinPhone,
            service_interested: procedureName || "Walk-in",
          })
          .select()
          .single();
        resolvedIntakeId = newIntake?.id ?? null;
        clientEmail = walkinEmail;
        clientName = walkinName;
        clientPhone = walkinPhone;
      }
    } else if (resolvedIntakeId) {
      const { data: intake } = await supabase
        .from("intakes")
        .select("first_name, email, phone")
        .eq("id", resolvedIntakeId)
        .single();
      clientEmail = intake?.email ?? null;
      clientName = intake?.first_name ?? null;
      clientPhone = intake?.phone ?? null;
    }

    // ── Save treatment ─────────────────────────────────────────────────────
    const { data: treatment, error } = await supabase
      .from("treatments")
      .insert({
        nurse_id: user.id,
        intake_id: resolvedIntakeId,
        procedure_id: procedureId,
        procedure_name: procedureName,
        treatment_date: treatmentDate,
        notes: notes,
        came_via_bot: cameViaBot,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: "Failed to save treatment" }, { status: 500 });

    // ── Auto-create check-in reminder ──────────────────────────────────────
    try {
      let checkinDays = 14;
      if (procedureId) {
        const { data: proc } = await supabase
          .from("procedures")
          .select("checkin_days")
          .eq("id", procedureId)
          .maybeSingle();
        if (proc?.checkin_days != null) checkinDays = proc.checkin_days;
      }
      const dueDate = new Date(treatmentDate + "T00:00:00Z");
      dueDate.setUTCDate(dueDate.getUTCDate() + checkinDays);
      const dueDateStr = dueDate.toISOString().slice(0, 10);
      await supabase.from("checkin_reminders").insert({
        nurse_id: user.id,
        treatment_id: treatment.id,
        intake_id: resolvedIntakeId,
        due_date: dueDateStr,
        status: "pending",
      });
    } catch {
      // Never block treatment save on reminder creation failure
    }

    // ── Get bot info ───────────────────────────────────────────────────────
    const { data: bot } = await supabase
      .from("bots")
      .select("practice_name, booking_link")
      .eq("nurse_id", user.id)
      .single();

    const practiceName = bot?.practice_name || "your provider";

    // ── Get procedures for aftercare ───────────────────────────────────────
    const allProcedureIds = procedureIds.length > 0
      ? procedureIds
      : (procedureId ? [procedureId] : []);

    const { data: selectedProcedures } = allProcedureIds.length > 0
      ? await supabase.from("procedures").select("*").in("id", allProcedureIds)
      : { data: [] };

    // Custom (non-list) procedure support: the client sends AI-generated instructions
    // for a typed-in procedure that isn't in the nurse's saved Procedures list.
    const customAftercareInstructions = typeof body.custom_aftercare_instructions === "string"
      ? body.custom_aftercare_instructions.trim()
      : "";

    // Optional per-client extra notes (e.g. more discomfort than usual, unusual visit) —
    // appended to whatever aftercare content is sent, on top of the normal instructions.
    const extraAftercareNotes = typeof body.extra_aftercare_notes === "string"
      ? body.extra_aftercare_notes.trim().slice(0, 1000)
      : "";

    const hasStandardProcedures = !!(selectedProcedures && selectedProcedures.length > 0);
    const hasCustomAftercare = !!(procedureName && customAftercareInstructions);

    // ── Send combined aftercare email ──────────────────────────────────────
    let aftercareSent = false;

    if (
      clientEmail &&
      sendAftercare &&
      (hasStandardProcedures || hasCustomAftercare)
    ) {
      let combinedAftercareHtml = "";

      if (hasStandardProcedures) {
        combinedAftercareHtml = selectedProcedures
          .map((proc) => {
            const instructions = (proc.aftercare_instructions ?? "").trim()
              || "Take it easy, stay hydrated, and avoid strenuous activity for 24 hours. Reach out if you have any questions or concerns!";
            return `
        <div style="background:#f0fdf4;border-radius:14px;padding:20px;margin:16px 0;border-left:4px solid #0d9488;">
          <h3 style="margin:0 0 10px;color:#0d9488;font-size:15px;font-weight:600;">📋 ${escapeHtml(proc.name ?? "")} Aftercare</h3>
          <p style="margin:0;color:#1a2744;font-size:14px;line-height:1.75;white-space:pre-wrap;">${escapeHtml(instructions)}</p>
        </div>`;
          })
          .join("");
      } else if (hasCustomAftercare) {
        combinedAftercareHtml = `
        <div style="background:#f0fdf4;border-radius:14px;padding:20px;margin:16px 0;border-left:4px solid #0d9488;">
          <h3 style="margin:0 0 10px;color:#0d9488;font-size:15px;font-weight:600;">📋 ${escapeHtml(procedureName)} Aftercare</h3>
          <p style="margin:0;color:#1a2744;font-size:14px;line-height:1.75;white-space:pre-wrap;">${escapeHtml(customAftercareInstructions)}</p>
        </div>`;
      }

      if (extraAftercareNotes) {
        combinedAftercareHtml += `
        <div style="background:#fff7ed;border-radius:14px;padding:20px;margin:16px 0;border-left:4px solid #f97316;">
          <h3 style="margin:0 0 10px;color:#c2410c;font-size:15px;font-weight:600;">💬 A note just for you</h3>
          <p style="margin:0;color:#1a2744;font-size:14px;line-height:1.75;white-space:pre-wrap;">${escapeHtml(extraAftercareNotes)}</p>
        </div>`;
      }

      const aftercareSendResult = await resend.emails.send({
        from: "AdonisBlue <hi@adonisblue.io>",
        to: clientEmail,
        subject: `Your aftercare instructions from ${practiceName} 💙`,
        html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#1a2744;padding:28px 32px;text-align:center;">
          <img src="${SITE_URL}/Alona.png" alt="AdonisBlue" width="44" height="44" style="border-radius:10px;display:block;margin:0 auto 10px;" />
          <span style="color:#fff;font-size:18px;font-weight:600;">${escapeHtml(practiceName)}</span>
        </td></tr>
        <tr><td style="padding:36px 32px;">
          <h1 style="margin:0 0 8px;color:#1a2744;font-size:22px;font-weight:600;">You're glowing, ${escapeHtml(clientName ?? "beautiful")}! 🌸</h1>
          <p style="margin:0 0 8px;color:#475569;font-size:14px;">Thank you for your visit today. Here are your aftercare instructions for everything we did:</p>
          ${combinedAftercareHtml}
          <div style="background:#1a2744;border-radius:14px;padding:20px;margin:20px 0;text-align:center;">
            <p style="margin:0 0 8px;color:#ffffff;font-size:15px;font-weight:600;">Have recovery questions? 💙</p>
            <p style="margin:0 0 12px;color:#94a3b8;font-size:13px;">Our 24/7 recovery chat is here for you.</p>
            <a href="${SITE_URL}/healing/${treatment.id}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:50px;">💬 Open recovery chat</a>
          </div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">Sent with care by ${escapeHtml(practiceName)} via AdonisBlue</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
      });

      if (aftercareSendResult.error) {
        console.error("Aftercare email failed to send:", aftercareSendResult.error);
      } else {
        await supabase
          .from("treatments")
          .update({
            aftercare_sent: true,
            aftercare_sent_at: new Date().toISOString(),
          })
          .eq("id", treatment.id);

        aftercareSent = true;
      }
    }

    // clientPhone intentionally not returned — not needed by client
    void clientPhone;

    return NextResponse.json({ treatment, aftercare_sent: aftercareSent });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// ── PATCH /api/treatments — soft-delete (archive) a treatment ─────────────────
// Body: { id: string }  →  sets archived = true, scoped by nurse_id
export async function PATCH(request: Request) {
  try {
    const token = getAuthToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getAuthUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id || !UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid treatment id" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from("treatments")
      .update({ archived: true })
      .eq("id", id)
      .eq("nurse_id", user.id); // ownership — nurse can only archive her own records

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
