import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";

const DEFAULT_EMERGENCY_KEYWORDS = [
  "purple", "blue lips", "can't breathe", "cannot breathe", "severe pain",
  "extreme pain", "fever", "infection", "allergic", "anaphylaxis", "swelling won't stop",
  "getting worse", "emergency", "hospital", "911", "help me", "scared",
  "numb", "vision", "blindness", "vascular", "necrosis"
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const treatmentId = searchParams.get("treatment_id");
    if (!treatmentId) return NextResponse.json({ error: "Missing treatment_id" }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: treatment } = await supabase
      .from("treatments")
      .select("*, intakes(first_name, email), procedures(name, aftercare_instructions)")
      .eq("id", treatmentId)
      .single();

    if (!treatment) return NextResponse.json({ error: "Treatment not found" }, { status: 404 });

    const { data: chat } = await supabase
      .from("healing_chats")
      .select("*")
      .eq("treatment_id", treatmentId)
      .single();

    const { data: keywords } = await supabase
      .from("emergency_keywords")
      .select("keyword")
      .eq("nurse_id", treatment.nurse_id);

    return NextResponse.json({
      treatment,
      chat,
      emergency_keywords: [
        ...DEFAULT_EMERGENCY_KEYWORDS,
        ...(keywords ?? []).map((k: { keyword: string }) => k.keyword)
      ]
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { treatment_id, messages, flagged, flagged_message } = body;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: treatment } = await supabase
      .from("treatments")
      .select("*, intakes(first_name, email, phone), procedures(name, aftercare_instructions), bots:nurse_id(practice_name, notification_email)")
      .eq("id", treatment_id)
      .single();

    if (!treatment) return NextResponse.json({ error: "Treatment not found" }, { status: 404 });

    const clientName = treatment.intakes?.first_name || "Client";
    const procedureName = (treatment.procedures as any)?.name || "procedure";
    const nurseEmail = (treatment.bots as any)?.notification_email;
    const practiceName = (treatment.bots as any)?.practice_name || "your practice";

    // Save or update chat
    await supabase
      .from("healing_chats")
      .upsert({
        treatment_id,
        nurse_id: treatment.nurse_id,
        client_name: clientName,
        messages,
        flagged: flagged || false,
        flagged_message: flagged_message || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "treatment_id" });

    // Send emergency alert to nurse
    if (flagged && nurseEmail) {
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
          <p style="margin:0 0 16px;color:#1a2744;font-size:16px;"><strong>${clientName}</strong> reported a concerning symptom after their <strong>${procedureName}</strong>:</p>
          <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0;color:#dc2626;font-size:15px;font-weight:600;">"${flagged_message}"</p>
          </div>
          <p style="margin:16px 0;color:#475569;font-size:14px;">Contact details:</p>
          <p style="margin:4px 0;color:#1a2744;font-size:14px;">📧 ${treatment.intakes?.email || "No email"}</p>
          <p style="margin:4px 0;color:#1a2744;font-size:14px;">📱 ${treatment.intakes?.phone || "No phone"}</p>
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
    const aftercareInstructions = (treatment.procedures as any)?.aftercare_instructions || "";
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
        messages: messages.filter((m: { role: string }) => m.role === "user" || m.role === "assistant"),
      }),
    });

    const aiData = await aiRes.json();
    const aiMessage = aiData.content?.[0]?.text || "I'm here to help with your recovery! Could you tell me more about what you're experiencing?";

    return NextResponse.json({ message: aiMessage, flagged });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
