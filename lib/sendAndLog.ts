import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";

const resend = new Resend(process.env.RESEND_API_KEY);

interface EmailOpts {
  type: string;
  nurse_id?: string | null;
  intake_id?: string | null;
  treatment_id?: string | null;
  to: string | null | undefined;
  subject: string;
  html: string;
  supabase: SupabaseClient;
}

interface SmsOpts {
  type: string;
  nurse_id?: string | null;
  intake_id?: string | null;
  treatment_id?: string | null;
  to: string | null | undefined;
  body: string;
  supabase: SupabaseClient;
}

interface SendResult {
  ok: boolean;
  error?: string;
  provider_id?: string;
}

export async function sendEmail(opts: EmailOpts): Promise<SendResult> {
  const { type, nurse_id, intake_id, treatment_id, to, subject, html, supabase } = opts;

  if (!to) {
    await supabase.from("message_log").insert({
      type,
      channel: "email",
      nurse_id: nurse_id ?? null,
      intake_id: intake_id ?? null,
      treatment_id: treatment_id ?? null,
      to_address: null,
      status: "skipped",
      error: "no to address",
    });
    return { ok: false, error: "no to address" };
  }

  try {
    const result = await resend.emails.send({
      from: "AdonisBlue <hi@adonisblue.io>",
      to,
      subject,
      html,
    });

    const provider_id = (result.data as { id?: string } | null)?.id ?? null;

    await supabase.from("message_log").insert({
      type,
      channel: "email",
      nurse_id: nurse_id ?? null,
      intake_id: intake_id ?? null,
      treatment_id: treatment_id ?? null,
      to_address: to,
      status: "sent",
      provider_id,
    });

    return { ok: true, provider_id: provider_id ?? undefined };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);

    await supabase.from("message_log").insert({
      type,
      channel: "email",
      nurse_id: nurse_id ?? null,
      intake_id: intake_id ?? null,
      treatment_id: treatment_id ?? null,
      to_address: to,
      status: "failed",
      error,
    });

    return { ok: false, error };
  }
}

export async function sendSms(opts: SmsOpts): Promise<SendResult> {
  const { type, nurse_id, intake_id, treatment_id, to, body, supabase } = opts;

  if (!to) {
    await supabase.from("message_log").insert({
      type,
      channel: "sms",
      nurse_id: nurse_id ?? null,
      intake_id: intake_id ?? null,
      treatment_id: treatment_id ?? null,
      to_address: null,
      status: "skipped",
      error: "no to address",
    });
    return { ok: false, error: "no to address" };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    const error = "Twilio credentials not configured";
    await supabase.from("message_log").insert({
      type,
      channel: "sms",
      nurse_id: nurse_id ?? null,
      intake_id: intake_id ?? null,
      treatment_id: treatment_id ?? null,
      to_address: to,
      status: "failed",
      error,
    });
    return { ok: false, error };
  }

  try {
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        },
        body: new URLSearchParams({ From: fromNumber, To: to, Body: body }),
      }
    );

    const data = await resp.json() as { sid?: string; error_message?: string; message?: string };

    if (!resp.ok) {
      throw new Error(data.error_message ?? data.message ?? `Twilio ${resp.status}`);
    }

    const provider_id = data.sid ?? null;

    await supabase.from("message_log").insert({
      type,
      channel: "sms",
      nurse_id: nurse_id ?? null,
      intake_id: intake_id ?? null,
      treatment_id: treatment_id ?? null,
      to_address: to,
      status: "sent",
      provider_id,
    });

    return { ok: true, provider_id: provider_id ?? undefined };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);

    await supabase.from("message_log").insert({
      type,
      channel: "sms",
      nurse_id: nurse_id ?? null,
      intake_id: intake_id ?? null,
      treatment_id: treatment_id ?? null,
      to_address: to,
      status: "failed",
      error,
    });

    return { ok: false, error };
  }
}

// ── Emergency alert with retry + failure escalation ──────────────────────────

interface EmergencyAlertOpts {
  nurseEmail: string | null | undefined;
  nurseId: string;
  practiceName: string;
  type: "chat" | "healing" | "review";
  subject: string;
  html: string;
  supabase: SupabaseClient;
}

export async function sendEmergencyAlert(opts: EmergencyAlertOpts): Promise<void> {
  const { nurseEmail, nurseId, practiceName, type, subject, html, supabase } = opts;

  if (!nurseEmail) {
    // Log the miss and immediately escalate
    await supabase.from("message_log").insert({
      type: "emergency_alert",
      channel: "email",
      nurse_id: nurseId,
      to_address: null,
      status: "skipped",
      error: `no nurse email — type:${type}`,
    });
    await _escalateEmergencyFailure({ nurseId, practiceName, type, error: "nurse has no email address", supabase });
    return;
  }

  // Attempt 1
  const r1 = await _attemptEmergencyEmail({ nurseEmail, subject, html, attempt: 1, nurseId, type, supabase });
  if (r1.ok) return;

  // Wait ~2s and retry
  await new Promise(res => setTimeout(res, 2000));

  const r2 = await _attemptEmergencyEmail({ nurseEmail, subject, html, attempt: 2, nurseId, type, supabase });
  if (r2.ok) return;

  // Both attempts failed — escalate
  await _escalateEmergencyFailure({ nurseId, practiceName, type, error: r2.error ?? "unknown", supabase });
}

async function _attemptEmergencyEmail(opts: {
  nurseEmail: string;
  subject: string;
  html: string;
  attempt: number;
  nurseId: string;
  type: string;
  supabase: SupabaseClient;
}): Promise<SendResult> {
  const { nurseEmail, subject, html, attempt, nurseId, type, supabase } = opts;
  try {
    const result = await resend.emails.send({
      from: "AdonisBlue <hi@adonisblue.io>",
      to: nurseEmail,
      subject,
      html,
    });
    const provider_id = (result.data as { id?: string } | null)?.id ?? null;
    await supabase.from("message_log").insert({
      type: "emergency_alert",
      channel: "email",
      nurse_id: nurseId,
      to_address: nurseEmail,
      status: "sent",
      provider_id,
      attempt,
      error: `alert_type:${type}`,
    });
    return { ok: true, provider_id: provider_id ?? undefined };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await supabase.from("message_log").insert({
      type: "emergency_alert",
      channel: "email",
      nurse_id: nurseId,
      to_address: nurseEmail,
      status: "failed",
      attempt,
      error: `${error} | alert_type:${type}`,
    });
    return { ok: false, error };
  }
}

async function _escalateEmergencyFailure(opts: {
  nurseId: string;
  practiceName: string;
  type: string;
  error: string;
  supabase: SupabaseClient;
}): Promise<void> {
  const { nurseId, practiceName, type, error, supabase } = opts;
  const now = new Date().toUTCString();
  try {
    await resend.emails.send({
      from: "AdonisBlue <hi@adonisblue.io>",
      to: "hi@adonisblue.io",
      subject: "⚠️ Emergency alert FAILED",
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#b91c1c;">⚠️ Emergency alert FAILED to deliver</h2>
        <p><strong>Nurse ID:</strong> ${nurseId}</p>
        <p><strong>Practice:</strong> ${practiceName}</p>
        <p><strong>Time:</strong> ${now}</p>
        <p><strong>Alert type:</strong> ${type}</p>
        <p><strong>Error:</strong> ${error}</p>
        <p style="color:#64748b;font-size:13px;">The nurse was NOT notified. Please follow up immediately.</p>
      </div>`,
    });
  } catch (escalateErr) {
    // Last resort — can't throw silently, log to console
    console.error("[emergency-escalation] FAILED to send escalation email:", escalateErr, { nurseId, type, error });
  }
  await supabase.from("message_log").insert({
    type: "emergency_alert",
    channel: "email",
    nurse_id: nurseId,
    to_address: "hi@adonisblue.io",
    status: "sent",
    error: `escalation — original error: ${error} | alert_type:${type}`,
  }).then(() => {}, () => {});
}
