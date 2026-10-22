import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmergencyAlert, sendSms } from "@/lib/sendAndLog";
import { detectEmergencySync, DEFAULT_EMERGENCY_KEYWORDS, normalizeText } from "@/lib/emergencyCheck";
import { logError } from "@/lib/logError";
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";

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
      .select("*, intakes(first_name, email, phone), procedures(name, aftercare_instructions)")
      .eq("id", treatmentId)
      .single();

    if (!treatment) {
      return NextResponse.json({ error: "Treatment not found" }, { status: 404 });
    }

    const [{ data: chat }, { data: keywords }, { data: botRow }] = await Promise.all([
      supabase.from("healing_chats").select("*").eq("treatment_id", treatmentId).single(),
      supabase.from("emergency_keywords").select("keyword").eq("nurse_id", treatment.nurse_id),
      supabase.from("bots").select("nurse_name").eq("nurse_id", treatment.nurse_id).single(),
    ]);

    const rawNurseName: string = (botRow as { nurse_name?: string } | null)?.nurse_name?.trim() ?? "";
    const nurseFirstName = rawNurseName
      ? rawNurseName.split(/\s+/)[0]!.charAt(0).toUpperCase() + rawNurseName.split(/\s+/)[0]!.slice(1).toLowerCase()
      : null;

    // Only expose what the client needs — never leak nurse contact/alert details here
    return NextResponse.json({
      treatment: {
        id: treatment.id,
        procedure_name: treatment.procedure_name,
        treatment_date: treatment.treatment_date,
        intakes: treatment.intakes
          ? {
              first_name: treatment.intakes.first_name,
              // Client's own phone — safe to return (UUID-gated URL, client's own data)
              phone: (treatment.intakes as { phone?: string }).phone ?? null,
            }
          : null,
        procedures: treatment.procedures
          ? {
              name: treatment.procedures.name,
              aftercare_instructions: treatment.procedures.aftercare_instructions,
            }
          : null,
        bots: null,
      },
      nurse_first_name: nurseFirstName,
      chat,
      emergency_keywords: [
        ...DEFAULT_EMERGENCY_KEYWORDS,
        ...(keywords ?? []).map((k: { keyword: string }) => k.keyword),
      ],
    });
  } catch (e) {
    await logError("healing", String(e));
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
        "*, intakes(first_name, email, phone), procedures(name, aftercare_instructions)"
      )
      .eq("id", treatment_id)
      .single();

    if (!treatment) {
      return NextResponse.json({ error: "Treatment not found" }, { status: 404 });
    }

    // Fetch bots separately — no FK constraint exists between treatments.nurse_id
    // and bots, so PostgREST join syntax fails. A plain .eq() query always works.
    const { data: botRow } = await supabase
      .from("bots")
      .select("practice_name, alert_email, notification_email, alert_phone")
      .eq("nurse_id", treatment.nurse_id)
      .single();

    const clientName = treatment.intakes?.first_name || "Client";
    const procedureName =
      (treatment.procedures as { name?: string } | null)?.name || "procedure";
    // Fallback chain: alert_email → notification_email
    const nurseEmail = (botRow as { alert_email?: string | null } | null)?.alert_email?.trim() || (botRow as { notification_email?: string | null } | null)?.notification_email || undefined;
    const alertPhone = (botRow as { alert_phone?: string } | null)?.alert_phone;
    const practiceName =
      (botRow as { practice_name?: string } | null)?.practice_name || "your practice";
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
    const isFlagged = detectEmergencySync(lastUserMessage, customKeywords);

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

    // ── Server-side dedup (conversation-scoped) ──────────────────────────
    // "Same conversation" = messages already in this healing chat.
    // Two different clients using the same nurse are never confused.
    const normalizedCurrentMsg = normalizeText(lastUserMessage).slice(0, 200);

    // All normalized user messages already in this conversation (excluding the current one)
    const prevConvMsgs = messages
      .filter((m) => m.role === "user")
      .slice(0, -1)
      .map((m) => normalizeText(m.content).slice(0, 200));

    let isDuplicateMessage = false;
    let isUpdate = false;
    let earlierAlertMsgs: string[] = [];

    if (isFlagged) {
      try {
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { data: recentRows } = await supabase
          .from("message_log")
          .select("error, created_at")
          .eq("type", "emergency_alert")
          .eq("nurse_id", treatment.nurse_id)
          .eq("status", "sent")
          .gte("created_at", twoHoursAgo)
          .order("created_at", { ascending: false });

        const rows = recentRows ?? [];

        // Skip only if same text within 10 min AND it was already in THIS chat's history
        const msgWasAlreadyInConv = prevConvMsgs.includes(normalizedCurrentMsg);
        isDuplicateMessage = msgWasAlreadyInConv &&
          rows
            .filter((r) => r.created_at >= tenMinAgo)
            .some((r) => {
              const m = typeof r.error === "string" ? r.error.match(/\bmsg:(.+)$/) : null;
              return m != null && m[1] === normalizedCurrentMsg;
            });

        if (!isDuplicateMessage) {
          // UPDATE: an earlier message from THIS chat was already alerted
          const matchingRows = rows.filter((r) => {
            const m = typeof r.error === "string" ? r.error.match(/\bmsg:(.+)$/) : null;
            return m != null && prevConvMsgs.includes(m[1]);
          });
          isUpdate = matchingRows.length > 0;
          earlierAlertMsgs = matchingRows
            .map((r) => {
              const m = typeof r.error === "string" ? r.error.match(/\bmsg:(.+)$/) : null;
              return m ? m[1] : null;
            })
            .filter((x): x is string => x !== null)
            .slice(0, 2);
        }
      } catch (dedupErr) {
        console.error("[healing-emergency] dedup check failed (proceeding):", dedupErr);
      }
    }

    // Log skip if exact duplicate within 10 min
    if (isDuplicateMessage) {
      supabase.from("message_log").insert({
        type: "emergency_alert",
        channel: "email",
        nurse_id: treatment.nurse_id,
        status: "skipped",
        error: "duplicate within 10 min",
      }).then(() => {}, () => {});
      console.log("[healing-emergency] Duplicate message within 10 min — skipping alert");
    }

    // ── Emergency alerts — email + SMS ────────────────────────────────────
    if (isFlagged && !isDuplicateMessage) {
      let alertEmailAddress = nurseEmail?.trim() || null;
      if (!alertEmailAddress) {
        try {
          const { data: authUser } = await supabase.auth.admin.getUserById(treatment.nurse_id);
          alertEmailAddress = authUser?.user?.email ?? null;
          if (alertEmailAddress) {
            console.log(`[emergency] no alert_email/notification_email — falling back to auth email: ${alertEmailAddress}`);
          } else {
            console.warn(`[emergency] No email found for nurse ${treatment.nurse_id} — alert email skipped`);
          }
        } catch (err) {
          console.error("[emergency] Failed to fetch auth fallback email:", err);
        }
      } else {
        console.log(`[emergency] Sending alert email to configured address: ${alertEmailAddress}`);
      }

      const msgPreview = escapeHtml(lastUserMessage.slice(0, 60));
      const healingSubject = isUpdate
        ? `⚠️ UPDATE — same client: "${msgPreview}" — ${practiceName}`
        : `⚠️ URGENT: ${clientName} needs attention after ${procedureName}`;

      const updateSection = isUpdate && earlierAlertMsgs.length > 0
        ? `<div style="background:#fff7ed;border:1px solid #f97316;border-radius:8px;padding:12px;margin:16px 0;">
            <p style="margin:0 0 6px;color:#c2410c;font-size:13px;font-weight:700;">Earlier message(s) from this client:</p>
            ${earlierAlertMsgs.map((m) => `<p style="margin:0 0 4px;color:#92400e;font-size:13px;">&ldquo;${escapeHtml(m)}&rdquo;</p>`).join("")}
          </div>`
        : "";

      await sendEmergencyAlert({
        nurseEmail: alertEmailAddress,
        nurseId: treatment.nurse_id,
        practiceName,
        type: "healing",
        subject: healingSubject,
        msgKey: normalizedCurrentMsg,
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
          ${updateSection}
          <p style="margin:0 0 16px;color:#1a2744;font-size:16px;"><strong>${escapeHtml(clientName)}</strong> reported a concerning symptom after their <strong>${escapeHtml(procedureName)}</strong>:</p>
          <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0;color:#dc2626;font-size:15px;font-weight:600;">&ldquo;${safeFlaggedMessage}&rdquo;</p>
          </div>
          <p style="margin:16px 0;color:#475569;font-size:14px;">Contact details:</p>
          <p style="margin:4px 0;color:#1a2744;font-size:14px;">📧 ${escapeHtml(treatment.intakes?.email || "No email")}</p>
          <p style="margin:4px 0;color:#1a2744;font-size:14px;">📱 ${escapeHtml(clientPhone)}</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="https://www.adonisblue.io/dashboard" style="display:inline-block;background:#ef4444;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:50px;">View in dashboard</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
        supabase,
      });

      // SMS
      if (alertPhone?.trim()) {
        const smsBody = `AdonisBlue Alert: ${clientName} needs attention after ${procedureName}. Check your dashboard or email for details.`;
        await sendSms({
          type: "emergency_alert",
          nurse_id: treatment.nurse_id,
          to: alertPhone.trim(),
          body: smsBody.slice(0, 160),
          supabase,
        });
      }
    }

    // Get AI response
    const apiKey = process.env.ANTHROPIC_API_KEY;

    const emergencyInstruction = isFlagged
      ? `\n\nEMERGENCY DETECTED — CRITICAL OVERRIDE: The client just described something that may need urgent medical attention. Your response must follow this exact order:
1. For symptoms involving breathing difficulty, chest pain, throat or tongue swelling, vision changes, skin turning white/gray/blue, or fainting — your first sentence must be: "Please call 911 or go to the nearest emergency room right now." Then say their nurse has been notified.
2. For other concerning symptoms — acknowledge warmly, confirm their nurse has been notified and will follow up.
End with [[ALERT_NURSE]] on its own line. Keep your response under 3 sentences. Calm, clear, direct. Never use pet names — no "sweetie", "hun", "babe", "beautiful", or similar.`
      : "";

    const systemPrompt = `You are a warm, caring post-procedure recovery assistant for ${practiceName}. The client just had a ${procedureName} procedure.

AFTERCARE INSTRUCTIONS FOR THIS PROCEDURE:
${aftercareInstructions}

YOUR ROLE:
- Answer recovery questions warmly and reassuringly
- Use the aftercare instructions above to give accurate answers
- Keep responses SHORT — 2-3 sentences max
- Be warm and human — like a caring friend who knows aesthetics
- Never diagnose or give medical advice beyond the aftercare instructions
- If something sounds concerning, acknowledge it warmly and say an alert has already been sent to the nurse — never promise the nurse will call or reach out
- Never use markdown, no bullet points, no bold text — plain conversational sentences only
- Emojis are fine and encouraged
- LANGUAGE: Respond in the same language the client is writing in. If the client writes in Spanish, respond entirely in Spanish. If they write in English, respond in English. Match their language naturally throughout.

SAFETY RULE — MEDICAL EMERGENCIES: If the client describes trouble breathing, chest pain, throat or tongue swelling, vision changes (blurry, double, or lost), skin turning white/gray/blue, fainting, severe or worsening pain, or any symptom that sounds like a medical emergency — OR if you advise calling 911, the ER, or urgent care — OR if you tell the client their nurse is being notified: append the exact token [[ALERT_NURSE]] on its own line at the very end of your reply. This token is invisible to the client and triggers the nurse alert system. Only include it when you genuinely believe the situation may need urgent attention.${emergencyInstruction}`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 300,
        system: systemPrompt,
        messages: messages.filter(
          (m) => m.role === "user" || m.role === "assistant"
        ),
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text().catch(() => `HTTP ${aiRes.status}`);
      await supabase.from("message_log").insert({
        type: "ai_error",
        channel: "email",
        nurse_id: treatment.nurse_id ?? null,
        status: "failed",
        error: errText.slice(0, 500),
      }).then(() => {}, () => {});
      return NextResponse.json({ message: "I'm here to help with your recovery! Could you tell me more about what you're experiencing?", flagged: false });
    }

    const aiData = await aiRes.json();
    const textBlock = Array.isArray(aiData.content)
      ? aiData.content.find((block: { type?: string; text?: string }) => block?.type === "text")
      : null;
    const rawAiMessage =
      textBlock?.text ||
      "I'm here to help with your recovery! Could you tell me more about what you're experiencing?";

    // ── AI second alarm: strip [[ALERT_NURSE]] token ──────────────────────
    const aiAlertToken = rawAiMessage.includes("[[ALERT_NURSE]]");
    const aiMessage = rawAiMessage.replace(/\[\[ALERT_NURSE\]\]\s*/g, "").trimEnd();

    // Fire AI-triggered alert only if keyword detector did NOT already fire, and not a duplicate
    if (aiAlertToken && !isFlagged && !isDuplicateMessage) {
      // Update healing_chats: set flagged=true so alert appears in bell and Your Secretary
      await supabase.from("healing_chats").upsert(
        {
          treatment_id,
          nurse_id: treatment.nurse_id,
          flagged: true,
          flagged_message: lastUserMessage.slice(0, 500),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "treatment_id" }
      );

      // Dedup for AI path — conversation-scoped, same logic as keyword path above
      let aiIsDuplicate = false;
      let aiIsUpdate = false;
      let aiEarlierMsgs: string[] = [];
      try {
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { data: aiRecentRows } = await supabase
          .from("message_log")
          .select("error, created_at")
          .eq("type", "emergency_alert")
          .eq("nurse_id", treatment.nurse_id)
          .eq("status", "sent")
          .gte("created_at", twoHoursAgo)
          .order("created_at", { ascending: false });
        const aiRows = aiRecentRows ?? [];
        const aiMsgWasInConv = prevConvMsgs.includes(normalizedCurrentMsg);
        aiIsDuplicate = aiMsgWasInConv &&
          aiRows
            .filter((r) => r.created_at >= tenMinAgo)
            .some((r) => {
              const m = typeof r.error === "string" ? r.error.match(/\bmsg:(.+)$/) : null;
              return m != null && m[1] === normalizedCurrentMsg;
            });
        if (!aiIsDuplicate) {
          const aiMatchingRows = aiRows.filter((r) => {
            const m = typeof r.error === "string" ? r.error.match(/\bmsg:(.+)$/) : null;
            return m != null && prevConvMsgs.includes(m[1]);
          });
          aiIsUpdate = aiMatchingRows.length > 0;
          aiEarlierMsgs = aiMatchingRows
            .map((r) => { const m = typeof r.error === "string" ? r.error.match(/\bmsg:(.+)$/) : null; return m ? m[1] : null; })
            .filter((x): x is string => x !== null)
            .slice(0, 2);
        }
      } catch (e) { await logError("healing", `dedup check failed: ${String(e)}`); }

      if (aiIsDuplicate) {
        supabase.from("message_log").insert({
          type: "emergency_alert", channel: "email",
          nurse_id: treatment.nurse_id, status: "skipped",
          error: "duplicate within 10 min",
        }).then(() => {}, () => {});
      } else {
        let alertEmailAi = nurseEmail?.trim() || null;
        if (!alertEmailAi) {
          try {
            const { data: authUser } = await supabase.auth.admin.getUserById(treatment.nurse_id);
            alertEmailAi = authUser?.user?.email ?? null;
          } catch (e) { await logError("healing", `auth email lookup failed: ${String(e)}`); }
        }

        const aiMsgPreview = escapeHtml(lastUserMessage.slice(0, 60));
        const subjectAI = aiIsUpdate
          ? `⚠️ UPDATE (AI-detected) — same client: "${aiMsgPreview}" — ${practiceName}`
          : `⚠️ URGENT: Client may need attention — AI-detected — ${practiceName}`;

        const aiUpdateSection = aiIsUpdate && aiEarlierMsgs.length > 0
          ? `<div style="background:#fff7ed;border:1px solid #f97316;border-radius:8px;padding:12px;margin:16px 0;">
              <p style="margin:0 0 6px;color:#c2410c;font-size:13px;font-weight:700;">Earlier message(s) from this client:</p>
              ${aiEarlierMsgs.map((m) => `<p style="margin:0 0 4px;color:#92400e;font-size:13px;">&ldquo;${escapeHtml(m)}&rdquo;</p>`).join("")}
            </div>`
          : "";

        await sendEmergencyAlert({
          nurseEmail: alertEmailAi,
          nurseId: treatment.nurse_id,
          practiceName,
          type: "healing",
          subject: subjectAI,
          msgKey: normalizedCurrentMsg,
          html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#fef2f2;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:2px solid #ef4444;">
        <tr><td style="background:#ef4444;padding:24px 32px;text-align:center;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">⚠️ AI-Detected Emergency — Healing Chat</p>
          <p style="margin:6px 0 0;color:#fecaca;font-size:13px;">${escapeHtml(practiceName)}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          ${aiUpdateSection}
          <p style="margin:0 0 16px;color:#1a2744;font-size:15px;">The AI assistant flagged a potential emergency in the recovery chat. Client: <strong>${escapeHtml(clientName)}</strong></p>
          <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:16px;margin:12px 0;">
            <p style="margin:0;color:#dc2626;font-size:15px;font-weight:600;">&ldquo;${escapeHtml(lastUserMessage.slice(0, 500))}&rdquo;</p>
          </div>
          <p style="margin:8px 0;color:#1a2744;font-size:14px;">📧 ${escapeHtml(treatment.intakes?.email || "No email")}</p>
          <p style="margin:4px 0;color:#1a2744;font-size:14px;">📱 ${escapeHtml(clientPhone)}</p>
          <p style="margin:12px 0 0;color:#64748b;font-size:13px;">Alert source: AI token (keyword list did not match)</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#ef4444;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:50px;">View in dashboard</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
          supabase,
        });
      }
    } else if (aiAlertToken && !isFlagged && isDuplicateMessage) {
      supabase.from("message_log").insert({
        type: "emergency_alert", channel: "email",
        nurse_id: treatment.nurse_id, status: "skipped",
        error: "duplicate within 10 min",
      }).then(() => {}, () => {});
    }

    return NextResponse.json({ message: aiMessage, flagged: isFlagged });
  } catch (e) {
    await logError("healing", String(e));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
