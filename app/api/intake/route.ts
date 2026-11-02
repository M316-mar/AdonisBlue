import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/sendAndLog";
import { logError } from "@/lib/logError";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      bot_id,
      practice_name,
      first_name,
      email,
      phone,
      had_procedures_before,
      on_blood_thinners,
      blood_thinner_details,
      allergies,
      medication_allergies,
      service_interested,
    } = body;

    if (!bot_id || typeof bot_id !== "string") {
      return NextResponse.json({ error: "Invalid bot_id" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Resolve nurse_id server-side from bot_id — never trust it from the client
    const { data: botRow, error: botErr } = await supabase
      .from("bots")
      .select("nurse_id")
      .eq("id", bot_id)
      .single();
    if (botErr || !botRow?.nurse_id) {
      await logError("intake", `bot lookup failed: ${botErr?.message ?? "not found"}`);
      return NextResponse.json({ error: "Bot not found" }, { status: 404 });
    }
    const nurse_id: string = botRow.nurse_id;

    // Normalize email for matching
    const normalizedEmail = typeof email === "string" && email.trim() ? email.trim().toLowerCase() : null;

    // Check if this client already has a folder (by email/phone AND matching name) before creating a new one.
    // Same email but a different name (e.g. a family member) must NOT be merged or overwritten.
    const normalizedIntakeName = typeof first_name === "string" ? first_name.trim().toLowerCase() : "";
    let existingIntake: { id: string } | null = null;
    if (normalizedEmail) {
      const { data } = await supabase
        .from("intakes")
        .select("id, first_name")
        .eq("nurse_id", nurse_id)
        .eq("email", normalizedEmail);
      existingIntake = (data ?? []).find((i) => i.first_name?.trim().toLowerCase() === normalizedIntakeName) ?? null;
    }
    if (!existingIntake && phone) {
      const { data } = await supabase
        .from("intakes")
        .select("id, first_name")
        .eq("nurse_id", nurse_id)
        .eq("phone", phone);
      existingIntake = (data ?? []).find((i) => i.first_name?.trim().toLowerCase() === normalizedIntakeName) ?? null;
    }

    if (existingIntake) {
      const { error: updateErr } = await supabase.from("intakes").update({
        first_name,
        email: normalizedEmail,
        phone,
        had_procedures_before,
        on_blood_thinners,
        blood_thinner_details,
        allergies,
        medication_allergies,
        service_interested,
        notified_nurse: false,
      }).eq("id", existingIntake.id);
      if (updateErr) await logError("intake", `update failed: ${updateErr.message}`, nurse_id);
    } else {
      const { error: insertErr } = await supabase.from("intakes").insert({
        bot_id,
        nurse_id,
        first_name,
        email: normalizedEmail,
        phone,
        had_procedures_before,
        on_blood_thinners,
        blood_thinner_details,
        allergies,
        medication_allergies,
        service_interested,
        notified_nurse: false,
      });
      if (insertErr) await logError("intake", `insert failed: ${insertErr.message}`, nurse_id);
    }

    // Fetch nurse notification email server-side
    const { data: notifRow } = await supabase
      .from("bots")
      .select("notification_email")
      .eq("nurse_id", nurse_id)
      .single();
    let nurseEmail: string | null = notifRow?.notification_email || null;
    if (!nurseEmail) {
      const { data: authUser } = await supabase.auth.admin.getUserById(nurse_id);
      nurseEmail = authUser?.user?.email ?? null;
    }

    if (nurseEmail) {
      const sendResult = await sendEmail({
        type: "intake_notification",
        nurse_id,
        to: nurseEmail,
        subject: `💙 New client intake — ${first_name} is ready to book!`,
        html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a2744;">New Client Intake — ${escapeHtml(practice_name)}</h2>
          <p style="color: #475569;">A new client just completed their intake form and is ready to book!</p>

          <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #0d9488; margin-top: 0;">Client Information</h3>
            <p><strong>Name:</strong> ${escapeHtml(first_name)}</p>
            <p><strong>Email:</strong> ${escapeHtml(email || "Not provided")}</p>
            <p><strong>Phone:</strong> ${escapeHtml(phone || "Not provided")}</p>
            <p><strong>Service interested in:</strong> ${escapeHtml(service_interested || "Not specified")}</p>
          </div>

          <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <h3 style="color: #0d9488; margin-top: 0;">Medical Information</h3>
            <p><strong>Had procedures before:</strong> ${had_procedures_before ? "Yes" : "No"}</p>
            <p><strong>On blood thinners:</strong> ${on_blood_thinners ? `Yes — ${escapeHtml(blood_thinner_details || "details not provided")}` : "No"}</p>
            <p><strong>Allergies:</strong> ${escapeHtml(allergies || "None reported")}</p>
            <p><strong>Medication allergies:</strong> ${escapeHtml(medication_allergies || "None reported")}</p>
          </div>

          <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">
            Sent by AdonisBlue — your client is waiting 💙
          </p>
        </div>
      `,
        supabase,
      });
      if (!sendResult.ok) await logError("intake", `email send failed: ${sendResult.error ?? "unknown"}`, nurse_id);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    await logError("intake", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}