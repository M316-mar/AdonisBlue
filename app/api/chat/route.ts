import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import twilio from "twilio";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.adonisblue.io";

// ── Emergency keyword list — single source of truth shared with /api/healing ──
// IMPORTANT: Keep this list in sync with /api/healing/route.ts
const DEFAULT_EMERGENCY_KEYWORDS = [
  "purple", "blue lips", "can't breathe", "cannot breathe", "severe pain",
  "extreme pain", "fever", "infection", "allergic", "anaphylaxis", "swelling won't stop",
  "getting worse", "emergency", "hospital", "911", "help me", "scared",
  "numb", "vision", "blindness", "vascular", "necrosis",
];

/** Server-side keyword check — never trust the client's flagged value. */
function detectEmergency(text: string): boolean {
  const lower = text.toLowerCase();
  return DEFAULT_EMERGENCY_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

/** Escape HTML special chars to prevent XSS in email bodies. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Scan conversation history for client name and phone.
 * Returns { name, phone } — either may be null if not found.
 * Looks for patterns common in the bot's intake flow.
 */
function extractContactFromHistory(
  messages: { role: string; content: string }[]
): { name: string | null; phone: string | null } {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");

  // Phone: match common formats (10+ digits, with optional spaces/dashes/parens/+)
  const phoneMatch = userMessages.match(/(?:\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/);
  const phone = phoneMatch ? phoneMatch[0].trim() : null;

  // Name: look for lines that are 2–4 words, likely in response to "your full name" / "your name"
  // Check assistant messages for the name-asking turn, then take the next user reply
  let name: string | null = null;
  for (let i = 0; i < messages.length - 1; i++) {
    const msg = messages[i];
    if (
      msg.role === "assistant" &&
      (msg.content.toLowerCase().includes("full name") ||
        msg.content.toLowerCase().includes("your name"))
    ) {
      const nextUser = messages[i + 1];
      if (nextUser?.role === "user") {
        const candidate = nextUser.content.trim();
        // A name response is typically short (1–5 words) and not a question
        if (candidate.length < 60 && candidate.split(/\s+/).length <= 5 && !candidate.includes("?")) {
          name = candidate;
          break;
        }
      }
    }
  }

  return { name, phone };
}

export async function POST(request: Request) {
  try {
    const { messages, botContext } = await request.json();
    const botConfig = botContext || {};

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Configuration error" }, { status: 500 });
    }

    // ── Fetch active offers for this nurse ────────────────────────────────
    let activeOffersBlock = "";
    if (botConfig.nurse_id) {
      try {
        const db = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const now = new Date().toISOString();
        const { data: offerRows } = await db
          .from("offers")
          .select("title, description, discount_type, discount_value, expires_at")
          .eq("nurse_id", botConfig.nurse_id)
          .eq("active", true)
          .or(`starts_at.is.null,starts_at.lte.${now}`)
          .or(`expires_at.is.null,expires_at.gte.${now}`);

        if (offerRows && offerRows.length > 0) {
          const lines = offerRows.map((o: Record<string, unknown>) => {
            const disc =
              o.discount_type === "addon"
                ? "Free add-on"
                : o.discount_type === "percentage"
                  ? `${String(o.discount_value ?? "")}% off`
                  : `$${String(o.discount_value ?? "")} off`;
            const expiry = o.expires_at
              ? `valid until ${new Date(o.expires_at as string).toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
              : "ongoing";
            return `- ${String(o.title)}: ${String(o.description ?? "")} (${disc}, ${expiry})`;
          });
          activeOffersBlock = `\n\nCURRENT ACTIVE OFFERS:\n${lines.join("\n")}\nWhen clients ask about pricing, services, or bookings, naturally mention these offers. Don't force it — only bring it up when relevant.`;
        }
      } catch {
        // Non-fatal — proceed without offers
      }
    }

    // ── Emergency keyword detection — server-side, before AI call ─────────
    // Check the latest user message only (the one that just arrived)
    const lastUserMessage =
      [...(messages as { role: string; content: string }[])]
        .reverse()
        .find((m) => m.role === "user")?.content ?? "";

    const isFlagged = detectEmergency(lastUserMessage);

    // Deduplication flags passed from client state
    const alreadyAlerted = botConfig.emergencyAlertedThisSession === true;
    const alreadyAlertedWithoutContact = botConfig.emergencyAlertedWithoutContact === true;

    // Response flags to send back to client for state update
    let responseEmergencyAlerted = alreadyAlerted;
    let responseAlertedWithoutContact = alreadyAlertedWithoutContact;

    // ── Determine if we should fire an alert ──────────────────────────────
    // Extract contact info already given in this conversation
    const { name: clientName, phone: clientPhone } = extractContactFromHistory(
      messages as { role: string; content: string }[]
    );
    const hasContact = Boolean(clientName || clientPhone);

    const shouldAlert =
      isFlagged &&
      botConfig.nurse_id &&
      (
        // Case A: not alerted at all yet
        !alreadyAlerted ||
        // Case B: previously alerted without contact, now have contact — send follow-up
        (alreadyAlertedWithoutContact && hasContact)
      );

    if (isFlagged) {
      console.log(`[chat-emergency] Keyword detected in message: "${lastUserMessage.slice(0, 80)}"`);
      console.log(`[chat-emergency] hasContact=${hasContact} (name="${clientName}", phone="${clientPhone}")`);
      console.log(`[chat-emergency] alreadyAlerted=${alreadyAlerted}, alreadyAlertedWithoutContact=${alreadyAlertedWithoutContact}`);
      console.log(`[chat-emergency] shouldAlert=${shouldAlert}`);
    }

    if (shouldAlert) {
      // Non-blocking — alerts must never stall the chat response
      void (async () => {
        try {
          const db = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          // Fetch nurse alert settings from bots table
          const { data: botRow } = await db
            .from("bots")
            .select("notification_email, alert_phone, practice_name")
            .eq("nurse_id", botConfig.nurse_id)
            .single();

          const isFollowUp = alreadyAlerted && alreadyAlertedWithoutContact && hasContact;
          const noContact = !hasContact;

          // ── Resolve alert email (with auth fallback) ──────────────────
          let alertEmail = botRow?.notification_email?.trim() || null;
          if (!alertEmail) {
            try {
              const { data: authUser } = await db.auth.admin.getUserById(botConfig.nurse_id);
              alertEmail = authUser?.user?.email ?? null;
              if (alertEmail) {
                console.log(`[chat-emergency] notification_email not set — falling back to auth email: ${alertEmail}`);
              } else {
                console.warn(`[chat-emergency] No email found for nurse ${botConfig.nurse_id} — email skipped`);
              }
            } catch (err) {
              console.error("[chat-emergency] Failed to fetch auth fallback email:", err);
            }
          } else {
            console.log(`[chat-emergency] Sending alert to notification_email: ${alertEmail}`);
          }

          const practiceName = botRow?.practice_name || botConfig.practice_name || "your practice";
          const safeMsg = escapeHtml(lastUserMessage.slice(0, 500));
          const safeClient = escapeHtml(clientName || "Unknown");
          const safePhone = escapeHtml(clientPhone || "Not provided");

          const subjectPrefix = isFollowUp
            ? "⚠️ FOLLOW-UP — Contact info now available"
            : noContact
              ? "⚠️ URGENT: Emergency keyword detected — no contact info yet"
              : `⚠️ URGENT: Client needs attention`;

          const subject = `${subjectPrefix} — ${practiceName} AI bot`;

          const contactWarning = noContact
            ? `<div style="background:#fff7ed;border:2px solid #f97316;border-radius:8px;padding:12px;margin:16px 0;">
                <p style="margin:0;color:#c2410c;font-size:14px;font-weight:700;">⚠️ Name/phone not yet provided — review chat transcript below</p>
              </div>`
            : "";

          const followUpNote = isFollowUp
            ? `<div style="background:#f0fdf4;border:2px solid #22c55e;border-radius:8px;padding:12px;margin:16px 0;">
                <p style="margin:0;color:#15803d;font-size:14px;font-weight:700;">✅ Contact info now available — client provided details after initial alert</p>
              </div>`
            : "";

          const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#fef2f2;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:2px solid #ef4444;">
        <tr><td style="background:#ef4444;padding:24px 32px;text-align:center;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">⚠️ Emergency Keyword — AI Chat Bot</p>
          <p style="margin:6px 0 0;color:#fecaca;font-size:13px;">${escapeHtml(practiceName)}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          ${followUpNote}
          ${contactWarning}
          <p style="margin:0 0 8px;color:#1a2744;font-size:15px;">A client typed an emergency keyword in your AI chat bot:</p>
          <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:16px;margin:12px 0;">
            <p style="margin:0;color:#dc2626;font-size:15px;font-weight:600;">&ldquo;${safeMsg}&rdquo;</p>
          </div>
          <p style="margin:16px 0 4px;color:#475569;font-size:14px;font-weight:600;">Client contact info:</p>
          <p style="margin:4px 0;color:#1a2744;font-size:14px;">👤 Name: ${safeClient}</p>
          <p style="margin:4px 0;color:#1a2744;font-size:14px;">📱 Phone: ${safePhone}</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#ef4444;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:50px;">View dashboard</a>
          </div>
          <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">This alert was sent by AdonisBlue. The client is using your AI chat bot — not the healing chat.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

          // Send email
          if (alertEmail) {
            await resend.emails.send({
              from: "AdonisBlue <hello@adonisblue.io>",
              to: alertEmail,
              subject,
              html: emailHtml,
            });
            console.log(`[chat-emergency] Alert email sent to ${alertEmail}`);
          }

          // ── SMS via Twilio ────────────────────────────────────────────
          const alertPhone = botRow?.alert_phone?.trim() || null;
          if (alertPhone) {
            try {
              const accountSid = process.env.TWILIO_ACCOUNT_SID;
              const authToken  = process.env.TWILIO_AUTH_TOKEN;
              const fromNumber = process.env.TWILIO_PHONE_NUMBER;

              if (!accountSid || !authToken || !fromNumber) {
                console.warn("[chat-emergency] Twilio env vars not configured — SMS skipped");
              } else {
                const twilioClient = twilio(accountSid, authToken);
                const smsBody = noContact
                  ? `AdonisBlue Alert: Emergency keyword in AI bot — no contact info yet. Check your email & dashboard.`
                  : `AdonisBlue Alert: ${clientName || "Client"} (${clientPhone || "no phone"}) needs attention. Check your email & dashboard.`;
                await twilioClient.messages.create({
                  body: smsBody.slice(0, 160),
                  from: fromNumber,
                  to: alertPhone,
                });
                console.log(`[chat-emergency] SMS sent to ${alertPhone}`);
              }
            } catch (smsErr) {
              console.error("[chat-emergency] SMS failed (non-fatal):", smsErr);
            }
          } else {
            console.log("[chat-emergency] alert_phone not set — SMS skipped");
          }
        } catch (alertErr) {
          // Non-fatal — never let alert failure break the chat response
          console.error("[chat-emergency] Alert send failed (non-fatal):", alertErr);
        }
      })();

      // Update response flags
      responseEmergencyAlerted = true;
      responseAlertedWithoutContact = !hasContact;

      console.log(`[chat-emergency] Alert fired. hasContact=${hasContact}, isFollowUp=${alreadyAlertedWithoutContact && hasContact}`);
    } else if (isFlagged && alreadyAlerted) {
      console.log("[chat-emergency] Keyword detected but alert already sent this session — skipping duplicate");
    }

    // ── Inject emergency awareness into system prompt when flagged ─────────
    const emergencyInstruction = isFlagged
      ? `\n\nEMERGENCY DETECTED — CRITICAL OVERRIDE: The client just used language that may indicate a medical emergency. Your ONLY job right now is to:
1. Acknowledge their concern warmly and tell them their nurse has been alerted
2. ${hasContact ? "You already have their contact info — no need to ask again. Encourage them to call 911 or go to the ER if symptoms are severe." : "Gently ask for their full name and the best phone number to reach them right now, explaining: 'I want to make sure your nurse can reach you right away — can you share your name and best phone number?' Keep it brief and caring."}
3. Tell them to call 911 or go to the nearest emergency room if symptoms feel severe
Do NOT continue normal intake or booking conversation until this is addressed.`
      : "";

    const systemPrompt = `You are a warm, friendly assistant for ${botConfig.practice_name || "this aesthetic practice"} located in ${botConfig.city || "your area"}.

Your role is a sales-psychology driven customer service assistant. You are NOT pushy. You guide people warmly toward booking.

SERVICES OFFERED: ${(botConfig.services || []).join(", ")}

YOUR PERSONALITY:
- Warm, human, conversational — like a trusted friend who happens to know aesthetics
- Never use medical jargon. Say "tiny needle" not "cannula". Say "relaxer" not "neurotoxin". Say "safe gel" not "hyaluronic acid"
- Keep answers SHORT — 2-3 sentences max
- Always validate the client's feelings first before answering
- Use occasional emojis to feel warm and human
- Tone: ${botConfig.tone || "Warm & friendly"}

GREETING: Your opening message should feel completely unique to ${botConfig.practice_name} in ${botConfig.city}. Reference the specific services they offer. Never use a generic template greeting.

EARLY CONVERSATION:
In your very first message only — ask once and never again: "Have you seen our work before or is this your first time hearing about us?" If they say yes — skip ahead quickly to answering their questions and guiding them to book. If they say no or first time — warmly say: No worries! You can check out all our work on Instagram at ${botConfig.instagram || "our Instagram page"} — we post lots of before and afters there.${botConfig.facebook ? ` You can also find us on Facebook at ${botConfig.facebook}.` : ""}${botConfig.tiktok ? ` And follow us on TikTok at ${botConfig.tiktok} for fun videos!` : ""}${botConfig.website ? ` Our website is ${botConfig.website}.` : ""} Take a peek and come back with any questions! Once you have had a chance to look, I am here to help you book your spot 💕. IMPORTANT: Ask this question ONLY ONCE. If the client has already answered it or if you have already asked it, NEVER ask it again. Move forward with the conversation.

REFERRAL TRACKING: During the early conversation when you ask if they have seen the nurse's work before, if the client mentions where they found the practice or saw their work (Instagram, TikTok, Facebook, Google, a friend, etc.) — remember this. When you collect intake information, naturally ask: "By the way, how did you hear about us?" if they haven't already mentioned it. This helps the nurse know where her clients are coming from.

SALES PSYCHOLOGY RULES:
- People already WANT the procedure — they just need reassurance. Your job is to remove fear, not sell
- Never mention prices upfront. Instead build value first. Say things like "Most of our clients say it's one of the best decisions they've made"
- Only mention booking AFTER the client feels comfortable and asks about next steps or prices
- When someone asks about price say: "Pricing is personalized to exactly what you need — your nurse will go over everything with you at your appointment. Most clients are genuinely surprised by how reasonable it is! Ready to grab a spot? 💕"
- Handle fears with empathy: "That's totally normal to wonder about! Most people feel the same way before their first time..."
- Never push. If someone seems hesitant, back off and offer information instead
- When client seems ready to book, share the booking link: ${botConfig.booking_link || "contact us directly to book"}

RETURNING CLIENT FLOW:
If the client says they are a returning client or have visited before, use this shorter intake instead of the full new client intake. Ask one question at a time:
1. "Welcome back! 💕 So happy to see you again! Quick check-in — has anything changed with your health or medications since your last visit?"
2. Are you currently on any blood thinners or new medications?
3. Any new allergies since your last visit?
4. What service are you coming in for today?
Then send the booking link warmly. Do NOT ask for name, email or phone again for returning clients — they are already in the system.

INTAKE BEFORE BOOKING:
When the client shows interest in booking, asks about scheduling, or asks about prices, warmly begin collecting intake information — one question at a time, like a natural conversation (not a form). Ask only one question per message. In this order:
1. Full name — IMPORTANT: ask for their FULL name (first and last). You MUST say exactly: "Could I get your full name?" — never say "first name" only.
2. Email address
3. Phone number (optional — let them know they can skip)
4. Have they had any aesthetic procedures before? Yes or No
5. Are they on any blood thinners or medications? Yes or No — if yes, ask which ones
6. Any known allergies?
7. Are they allergic to any medications? Ask warmly and conversationally — for example lidocaine, penicillin, or any anesthetics
8. What service they are most interested in

After you have collected all of this information, say: "Perfect! I've noted everything down and your nurse will review it before your appointment. Here's the link to book your spot: ${botConfig.booking_link || "contact us directly to book"}. ${botConfig.deposit_info ? `Explain the deposit warmly: "${botConfig.deposit_info}"` : "A deposit is required to secure your appointment — it goes toward your treatment when you move forward!"}"

Do not share the booking link until intake is complete. Stay warm and human throughout — never rush or stack multiple questions in one message.

PHOTOS AND RESULTS:
When client asks to see work say: I'd love to show you! Check out our work on Instagram at ${botConfig.instagram || "our Instagram page"} — we post lots of before and afters! 🌸${botConfig.facebook ? ` Also on Facebook at ${botConfig.facebook}.` : ""}${botConfig.tiktok ? ` And TikTok at ${botConfig.tiktok}!` : ""}${botConfig.website ? ` Or visit our website at ${botConfig.website}.` : ""}

POLICIES:
${botConfig.cancellation_policy ? `Cancellation policy: ${botConfig.cancellation_policy}` : ""}
${botConfig.aftercare ? `Aftercare: ${botConfig.aftercare}` : ""}
IMPORTANT: Before you send the booking link you MUST first say the cancellation policy in plain English. Then after mentioning it send the booking link. Never send the booking link without mentioning the policy first.

${botConfig.numbing_method ? `NUMBING METHOD — CRITICAL: When anyone asks about pain, numbing, or comfort, you MUST mention this specific method and nothing else: "${botConfig.numbing_method}". Do not say "numbing cream" or any generic term. Use the nurse's exact method.` : "NUMBING: If asked about pain, say we use a topical numbing cream to make the experience as comfortable as possible."}
PREVIOUS FILLER WORK & CONSULTATION POLICY:
${botConfig.previous_work_policy ? `Nurse's policy on previous work: "${botConfig.previous_work_policy}"` : ""}
${botConfig.touch_up_policy ? `Nurse's touch up policy: "${botConfig.touch_up_policy}"` : ""}
${botConfig.same_day_consultation ? `Same day consultation policy: "${botConfig.same_day_consultation}"` : ""}

When a client mentions they have had filler before OR wants a touch up:
1. First ask warmly: "Have you had filler done by another nurse, or were you a client here before?"
2. If they had filler elsewhere and want a touch up → follow the touch up policy above. If no touch up policy, say the nurse will assess at consultation.
3. If they have previous filler from another nurse (not touch up) → say: "We'd love to have you in! We recommend starting with a consultation so your nurse can see your current filler and create the best plan for you 💕 Your deposit will go toward whatever service you choose that day — whether that's a touch up, dissolving, or new filler!"
4. If same day consultation is available → mention it warmly: "${botConfig.same_day_consultation || "Your nurse will discuss all options with you at your consultation."}"
5. If they ask about dissolving → let them know it's an option the nurse will discuss at consultation
6. Always guide them toward booking the consultation with the booking link

${botConfig.deposit_info ? `DEPOSIT: When clients ask about the deposit, explain it warmly in plain English: "${botConfig.deposit_info}"` : "DEPOSIT: A deposit is required to secure your appointment and goes toward your treatment."}

If asked something you cannot answer, say: "That's a great question! Let me have your nurse get back to you on that one personally 💙"

Always speak in plain simple English. No medical terms. Be the warm voice that makes someone feel safe enough to take the next step.

FORMATTING RULES — CRITICAL: Never use markdown in your responses. No asterisks for bold (**text**), no bullet points (- item or * item), no headers (#). Write in plain conversational sentences only. Emojis are fine and encouraged.${activeOffersBlock}${emergencyInstruction}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages,
      }),
    });

    const data = await res.json();
    const reply = data.content?.[0]?.text || "I'm here to help! Could you tell me a little more?";
    // Detect intake completion server-side
    const intakeComplete =
      reply.toLowerCase().includes("i've got everything noted") ||
      reply.toLowerCase().includes("i have everything noted") ||
      reply.toLowerCase().includes("here's the link to book") ||
      reply.toLowerCase().includes("here's your link to book") ||
      reply.toLowerCase().includes("here is the link to book") ||
      reply.toLowerCase().includes("here is your link to book") ||
      reply.toLowerCase().includes("link to book your") ||
      reply.toLowerCase().includes("link to book your consultation");

    // Save conversation to Supabase for insights
    if (botConfig.nurse_id && messages.length >= 2) {
      try {
        const supabaseInsights = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        await supabaseInsights.from("conversations").insert({
          nurse_id: botConfig.nurse_id,
          bot_id: botConfig.bot_id || null,
          messages: messages,
        });
      } catch (e) {
        console.error("Failed to save conversation:", e);
      }
    }

    if (intakeComplete && botConfig.nurse_email && botConfig.nurse_id && messages.length > 5) {
      const conversationText = messages
        .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
        .join("\n");

      // Fire and forget — don't await
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || "https://www.adonisblue.io"}/api/extract-intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation: conversationText,
          bot_id: botConfig.bot_id,
          nurse_id: botConfig.nurse_id,
          nurse_email: botConfig.nurse_email,
          practice_name: botConfig.practice_name,
        }),
      }).catch(console.error);
    }

    return NextResponse.json({
      reply,
      // Return updated deduplication flags for client state
      emergencyAlerted: responseEmergencyAlerted,
      emergencyAlertedWithoutContact: responseAlertedWithoutContact,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
