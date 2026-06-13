import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";

const DEFAULT_EMERGENCY_KEYWORDS = [
  "purple", "blue lips", "can't breathe", "cannot breathe", "severe pain",
  "extreme pain", "fever", "infection", "allergic", "anaphylaxis", "swelling won't stop",
  "getting worse", "emergency", "hospital", "911", "help me", "scared",
  "numb", "vision", "blindness", "vascular", "necrosis",
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Escape HTML special chars to prevent XSS in email bodies. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Server-side keyword check — never trust the client's flagged value. */
function detectEmergency(text: string, customKeywords: string[]): boolean {
  const lower = text.toLowerCase();
  const all = [...DEFAULT_EMERGENCY_KEYWORDS, ...customKeywords];
  return all.some((kw) => lower.includes(kw.toLowerCase()));
}

/** Sanitise and validate the messages array coming from the client. */
function sanitiseMessages(raw: unknown): { role: "user" | "assistant"; content: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (m): m is { role: string; content: string } =>
        m !== null &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
    .slice(-40) // keep at most the last 40 turns
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content.slice(0, 2000), // cap per-message length
    }));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const treatmentId = searchParams.get("treatment_id");

    if (!treatmentId || !UUID_REGEX.test(treatmentId)) {
      return NextResponse.json({ error: "Invalid treatment_id" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: treatment } = await supabase
      .from("treatments")
      .select("*, intakes(first_name, email), procedures(name, aftercare_instructions)")
      .eq("id", treatmentId)
      .single();

    if (!treatment) {
      return NextResponse.json({ error: "Treatment not found" }, { status: 404 });
    }

    const { data: chat } = await supabase
      .from("healing_chats")
      .select("*")
      .eq("treatment_id", treatmentId)
      .single();

    const { data: keywords } = await supabase
      .from("emergency_keywords")
      .select("keyword")
      .eq("nurse_id", treatment.nurse_id);

    // Only expose what the client needs — never leak nurse contact details here
    return NextResponse.json({
      treatment: {
        id: treatment.id,
        procedure_name: treatment.procedure_name,
        treatment_date: treatment.treatment_date,
        intakes: treatment.intakes
          ? { first_name: treatment.intakes.first_name }
          : null,
        procedures: treatment.procedures
          ? {
              name: treatment.procedures.name,
              aftercare_instructions: treatment.procedures.aftercare_instructions,
            }
          : null,
        bots: null, // not needed by client GET
      },
      chat,
      emergency_keywords: [
        ...DEFAULT_EMERGENCY_KEYWORDS,
        ...(keywords ?? []).map((k: { keyword: string }) => k.keyword),
      ],
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { treatment_id, messages: rawMessages, flagged_message } = body;

    // Validate treatment_id
    if (!treatment_id || !UUID_REGEX.test(String(treatment_id))) {
      return NextResponse.json({ error: "Invalid treatment_id" }, { status: 400 });
    }

    // Sanitise messages — never trust raw client input
    const messages = sanitiseMessages(rawMessages);
    if (messages.length === 0) {
      return NextResponse.json({ error: "No valid messages" }, { status: 400 });
    }

    // Sanitise optional client_phone — digits, spaces, +, -, () only
    const rawPhone = typeof body.client_phone === "string" ? body.client_phone : "";
    const clientPhoneInput = rawPhone.replace(/[^0-9\s\+\-\(\)]/g, "").slice(0, 20) || null;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: treatment } = await supabase
      .from("treatments")
      .select(
        "*, intakes(first_name, email, phone), procedures(name, aftercare_instructions), bots:nurse_id(practice_name, notification_email, alert_phone)"
      )
      .eq("id", treatment_id)
      .single();

    if (!treatment) {
      return NextResponse.json({ error: "Treatment not found" }, { status: 404 });
    }

    const clientName = treatment.intakes?.first_name || "Client";
    const procedureName =
      (treatment.procedures as { name?: string } | null)?.name || "procedure";
    const nurseEmail = (
      treatment.bots as { notification_email?: string } | null
    )?.notification_email;
    const alertPhone = (
      treatment.bots as { alert_phone?: string } | null
    )?.alert_phone;
    const practiceName =
      (treatment.bots as { practice_name?: string } | null)?.practice_name ||
      "your practice";
    const aftercareInstructions =
      (
        treatment.procedures as { aftercare_instructions?: string } | null
      )?.aftercare_instructions || "";

    const clientPhone =
      clientPhoneInput || treatment.intakes?.phone || "Not provided";

    // ── SECURITY: perform emergency check SERVER-SIDE ──────────────────────
    // Fetch custom keywords again so the client cannot influence this decision
    const { data: keywordRows } = await supabase
      .from("emergency_keywords")
      .select("keyword")
      .eq("nurse_id", treatment.nurse_id);

    const customKeywords = (keywordRows ?? []).map(
      (k: { keyword: string }) => k.keyword
    );

    // Check the latest user message (the one that triggered this POST)
    const lastUserMessage =
      [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    const isFlagged = detectEmergency(lastUserMessage, customKeywords);

    // Sanitise flagged_message for use in email HTML
    const safeFlaggedMessage = escapeHtml(
      typeof flagged_message === "string"
        ? flagged_message.slice(0, 500)
        : lastUserMessage.slice(0, 500)
    );

    // Save or update chat record
    await supabase.from("healing_chats").upsert(
      {
        treatment_id,
        nurse_id: treatment.nurse_id,
        client_name: clientName,
        messages,
        flagged: isFlagged,
        flagged_message: isFlagged ? lastUserMessage.slice(0, 500) : null,
        updated_at: new Date().toISOString(),
        client_phone: clientPhoneInput,
      },
      { onConflict: "treatment_id" }
    );

    // Send emergency alert email — only when the server independently confirmed the flag
    if (isFlagged && nurseEmail) {
      await resend.emails.send({
        from: "AdonisBlue <hello@adonisblue.io>",
        to: nurseEmail,
        subject: `⚠️ URGENT: ${clientName} needs attention after ${procedureName}`,
        html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#fef2f2;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:2px solid #ef4444;">
        <tr><td style="background:#ef4444;padding:24px 32px;text-align:center;">
          <span style="color:#fff;font-size:24px;">⚠️</span>
          <p style="margin:8px 0 0;color:#fff;font-size:18px;font-weight:700;">URGENT — Client needs attention</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#1a2744;font-size:16px;"><strong>${escapeHtml(clientName)}</strong> reported a concerning symptom after their <strong>${escapeHtml(procedureName)}</strong>:</p>
          <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0;color:#dc2626;font-size:15px;font-weight:600;">&ldquo;${safeFlaggedMessage}&rdquo;</p>
          </div>
          <p style="margin:16px 0;color:#475569;font-size:14px;">Contact details:</p>
          <p style="margin:4px 0;color:#1a2744;font-size:14px;">📧 ${escapeHtml(treatment.intakes?.email || "No email")}</p>
          <p style="margin:4px 0;color:#1a2744;font-size:14px;">📱 ${escapeHtml(clientPhone)}</p>
          ${alertPhone ? `<div style="background:#fef2f2;border-radius:8px;padding:12px;margin:16px 0;text-align:center;"><p style="margin:0;color:#dc2626;font-size:13px;">📲 Your alert phone: <strong>${escapeHtml(alertPhone)}</strong></p></div>` : ""}
          <div style="text-align:center;margin:24px 0;">
            <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#ef4444;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:50px;">View in dashboard</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
      });
    }

    // Get AI response
    const apiKey = process.env.ANTHROPIC_API_KEY;

    const systemPrompt = `You are a warm, caring post-procedure recovery assistant for ${practiceName}. The client just had a ${procedureName} procedure.

AFTERCARE INSTRUCTIONS FOR THIS PROCEDURE:
${aftercareInstructions}

YOUR ROLE:
- Answer recovery questions warmly and reassuringly
- Use the aftercare instructions above to give accurate answers
- Keep responses SHORT — 2-3 sentences max
- Be warm and human — like a caring friend who knows aesthetics
- Never diagnose or give medical advice beyond the aftercare instructions
- If something sounds concerning, acknowledge it warmly and say the nurse has been notified and will reach out soon
- Never use markdown, no bullet points, no bold text — plain conversational sentences only
- Emojis are fine and encouraged

IMPORTANT: If the client mentions ${DEFAULT_EMERGENCY_KEYWORDS.slice(0, 5).join(", ")} or anything that sounds like a medical emergency, tell them the nurse has been alerted and to seek immediate medical attention if symptoms are severe.`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: systemPrompt,
        messages: messages.filter(
          (m) => m.role === "user" || m.role === "assistant"
        ),
      }),
    });

    const aiData = await aiRes.json();
    const aiMessage =
      aiData.content?.[0]?.text ||
      "I'm here to help with your recovery! Could you tell me more about what you're experiencing?";

    return NextResponse.json({ message: aiMessage, flagged: isFlagged });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
