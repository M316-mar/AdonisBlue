import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logError";
import { promoteScheduledAftercares } from "@/lib/promoteScheduledAftercares";
import { substitutePlaceholdersSafeHtml } from "@/lib/substitutePlaceholders";
import { sendEmail } from "@/lib/sendAndLog";
import { firstName } from "@/lib/firstName";

const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid treatment id" }, { status: 400 });
    }

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

    // Fetch treatment with ownership check
    const { data: treatment, error: tErr } = await supabase
      .from("treatments")
      .select("id, nurse_id, intake_id, procedure_id, procedure_name, aftercare_send_at, aftercare_sent_at, aftercare_provider_id")
      .eq("id", id)
      .eq("nurse_id", user.id)
      .single();

    if (tErr || !treatment) return NextResponse.json({ error: "Treatment not found" }, { status: 404 });

    // If already promoted (Resend delivered, promotion ran) — just return success
    if (treatment.aftercare_sent_at) {
      return NextResponse.json({ ok: true, sent_at: treatment.aftercare_sent_at, already_sent: true });
    }

    // Get the Resend email id — primary source is treatments.aftercare_provider_id,
    // fallback to message_log for rows pre-dating that column.
    let providerId: string | null = (treatment as any).aftercare_provider_id ?? null;
    if (!providerId) {
      const { data: logRow } = await supabase
        .from("message_log")
        .select("provider_id")
        .eq("treatment_id", id)
        .eq("type", "aftercare")
        .eq("status", "scheduled")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      providerId = (logRow?.provider_id as string | null) ?? null;
    }

    // Try to cancel any pending scheduled Resend email (graceful — nothing to cancel is fine)
    if (providerId) {
      const { error: cancelErr } = await resend.emails.cancel(providerId);
      if (cancelErr) {
        // If already delivered, Resend returns an error — run promotion and return
        await promoteScheduledAftercares(supabase);
        const { data: refreshed } = await supabase
          .from("treatments")
          .select("aftercare_sent_at")
          .eq("id", id)
          .single();
        if (refreshed?.aftercare_sent_at) {
          return NextResponse.json({ ok: true, sent_at: refreshed.aftercare_sent_at, already_sent: true });
        }
      } else {
        // Mark the scheduled log row as canceled
        await supabase
          .from("message_log")
          .update({ status: "canceled" })
          .eq("treatment_id", id)
          .eq("type", "aftercare")
          .eq("status", "scheduled");
      }
    }

    // Build and send immediately
    const [intakeRes, botRes, procRes] = await Promise.all([
      treatment.intake_id
        ? supabase.from("intakes").select("first_name, email").eq("id", treatment.intake_id).single()
        : Promise.resolve({ data: null }),
      supabase.from("bots").select("practice_name, nurse_name, alert_phone, phone_public").eq("nurse_id", user.id).single(),
      treatment.procedure_id
        ? supabase.from("procedures").select("name, aftercare_instructions").eq("id", treatment.procedure_id).single()
        : Promise.resolve({ data: null }),
    ]);

    const intake = intakeRes.data;
    const bot = botRes.data;
    const proc = procRes.data;

    if (!intake?.email) {
      return NextResponse.json({ error: "No client email on file" }, { status: 422 });
    }

    const practiceName = bot?.practice_name || "your provider";
    const nurseDisplayName = bot?.nurse_name || bot?.practice_name || "";
    const nursePhone = bot?.phone_public || bot?.alert_phone || "";
    const clientName = firstName(intake.first_name, "beautiful");

    const rawInstructions = (proc?.aftercare_instructions ?? "").trim()
      || "Take it easy, stay hydrated, and avoid strenuous activity for 24 hours.";
    const instructionsHtml = substitutePlaceholdersSafeHtml(rawInstructions, nurseDisplayName, nursePhone);
    const procName = proc?.name || treatment.procedure_name || "your treatment";

    const html = `<!DOCTYPE html>
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
          <h1 style="margin:0 0 8px;color:#1a2744;font-size:22px;font-weight:600;">You're glowing, ${escapeHtml(clientName)}! 🌸</h1>
          <p style="margin:0 0 8px;color:#475569;font-size:14px;">Thank you for your visit today. Here are your aftercare instructions:</p>
          <div style="background:#f0fdf4;border-radius:14px;padding:20px;margin:16px 0;border-left:4px solid #0d9488;">
            <h3 style="margin:0 0 10px;color:#0d9488;font-size:15px;font-weight:600;">📋 ${escapeHtml(procName)} Aftercare</h3>
            <p style="margin:0;color:#1a2744;font-size:14px;line-height:1.75;white-space:pre-wrap;">${instructionsHtml}</p>
          </div>
          <div style="background:#1a2744;border-radius:14px;padding:20px;margin:20px 0;text-align:center;">
            <p style="margin:0 0 8px;color:#ffffff;font-size:15px;font-weight:600;">Have recovery questions? 💙</p>
            <a href="${SITE_URL}/healing/${id}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:50px;">💬 Open recovery chat</a>
          </div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">Sent with care by ${escapeHtml(practiceName)} via AdonisBlue</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const result = await sendEmail({
      type: "aftercare",
      nurse_id: user.id,
      treatment_id: id,
      intake_id: treatment.intake_id,
      to: intake.email,
      subject: `Your aftercare instructions from ${practiceName} 💙`,
      html,
      supabase,
    });

    if (!result.ok) {
      await logError("aftercare-now", result.error ?? "send failed");
      return NextResponse.json({ error: "Failed to send aftercare email" }, { status: 500 });
    }

    const sentAt = new Date().toISOString();

    await supabase
      .from("treatments")
      .update({ aftercare_sent: true, aftercare_sent_at: sentAt, aftercare_provider_id: null })
      .eq("id", id);

    if (treatment.intake_id) {
      await supabase
        .from("intakes")
        .update({ aftercare_sent_at: sentAt })
        .eq("id", treatment.intake_id);
    }

    return NextResponse.json({ ok: true, sent_at: sentAt });
  } catch (e) {
    await logError("aftercare-now", String(e));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
