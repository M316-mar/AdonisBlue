import { createClient } from "@supabase/supabase-js";
import { NextResponse, after } from "next/server";
import { sendEmergencyAlert, sendSms } from "@/lib/sendAndLog";
import { detectEmergencyLevel, normalizeText } from "@/lib/emergencyCheck";
import { buildEmergencyReply, emergencySubject } from "@/lib/emergencyReply";
import { logError } from "@/lib/logError";
import { phoneHtml } from "@/lib/formatPhone";
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.adonisblue.io";

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
): { name: string | null; phone: string | null; email: string | null } {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join("\n");

  // Phone: match common formats (10+ digits, with optional spaces/dashes/parens/+)
  const phoneMatch = userMessages.match(/(?:\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/);
  const phone = phoneMatch ? phoneMatch[0].trim() : null;

  // Email: standard RFC-ish pattern
  const emailMatch = userMessages.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0].trim() : null;

  // Name: look for lines that are 2–4 words, likely in response to "your full name" / "your name"
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
        if (candidate.length < 60 && candidate.split(/\s+/).length <= 5 && !candidate.includes("?")) {
          name = candidate;
          break;
        }
      }
    }
  }

  return { name, phone, email };
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

    // ── Fetch procedures from procedures table for this nurse ─────────────
    // These are the source of truth — richer than bots.services (include aftercare_instructions)
    let procedureRows: { name: string; aftercare_instructions?: string | null }[] = [];
    if (botConfig.nurse_id) {
      try {
        const db = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { data } = await db
          .from("procedures")
          .select("name, aftercare_instructions")
          .eq("nurse_id", botConfig.nurse_id)
          .order("created_at", { ascending: true });
        if (data && data.length > 0) procedureRows = data;
      } catch {
        // Non-fatal — fall back to bots.services below
      }
    }

    // Deduplicate procedures by name
    const uniqueProcedureRows = procedureRows.filter(
      (p, index, self) => index === self.findIndex((t) => t.name === p.name)
    );

    // Build service name list: procedures table wins, fall back to bots.services
    const serviceNames: string[] =
      uniqueProcedureRows.length > 0
        ? uniqueProcedureRows.map((p) => p.name)
        : (botConfig.services || []);

    // Build per-procedure aftercare block (only for procedures that have instructions)
    const procedureAftercareBlock = uniqueProcedureRows
      .filter((p) => p.aftercare_instructions?.trim())
      .map((p) => `${p.name}:\n${p.aftercare_instructions!.trim()}`)
      .join("\n\n");

    // ── Fetch custom emergency keywords for this nurse ────────────────────
    let customKeywords: string[] = [];
    if (botConfig.nurse_id) {
      try {
        const db = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { data: kwRows } = await db
          .from("emergency_keywords")
          .select("keyword")
          .eq("nurse_id", botConfig.nurse_id);
        if (kwRows && kwRows.length > 0) {
          customKeywords = kwRows.map((r: { keyword: string }) => r.keyword);
        }
      } catch {
        // Non-fatal — proceed with built-in keywords only
      }
    }

    // ── Emergency keyword detection — server-side, before AI call ─────────
    // Check the latest user message only (the one that just arrived)
    const lastUserMessage =
      [...(messages as { role: string; content: string }[])]
        .reverse()
        .find((m) => m.role === "user")?.content ?? "";

    const emergencyLevel = detectEmergencyLevel(lastUserMessage, customKeywords);
    const isFlagged = emergencyLevel !== null;

    // Fetch nurse phone synchronously when flagged — needed for server reply
    let nurseAlertPhone: string | null = null;
    if (isFlagged && botConfig.nurse_id) {
      try {
        const phoneDb = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { data: phoneRow } = await phoneDb
          .from("bots")
          .select("alert_phone")
          .eq("nurse_id", botConfig.nurse_id)
          .single();
        nurseAlertPhone = (phoneRow as { alert_phone?: string | null } | null)?.alert_phone?.trim() || null;
      } catch {
        // Non-fatal — reply omits phone
      }
    }

    // Contact-info follow-up tracking (client state — kept for follow-up UX only)
    const alreadyAlertedWithoutContact = botConfig.emergencyAlertedWithoutContact === true;
    let responseAlertedWithoutContact = alreadyAlertedWithoutContact;

    // Extract contact info already given in this conversation
    const { name: clientName, phone: clientPhone, email: clientEmail } = extractContactFromHistory(
      messages as { role: string; content: string }[]
    );
    const hasContact = Boolean(clientName || clientPhone || clientEmail);

    if (isFlagged) {
      console.log("[chat-emergency] Keyword detected in message");
      console.log(`[chat-emergency] hasContact=${hasContact}, alreadyAlertedWithoutContact=${alreadyAlertedWithoutContact}`);
    }

    // ── Bot identity (needed for emergency prompt and system prompt) ─────────
    const effectiveBotName = ((botConfig.bot_name as string | null)?.trim() || `${(botConfig.practice_name as string | null)?.trim() || "this practice"} Assistant`);
    const nurseFirst = (botConfig.nurse_name as string | null)?.trim().split(/\s+/)[0] ?? "";
    const nurseFirstForPrompt = nurseFirst || "your nurse";

    // ── Inject emergency awareness into system prompt when flagged ─────────
    const emergencyInstruction = isFlagged
      ? `\n\nEMERGENCY DETECTED — CRITICAL OVERRIDE: The client just described something that may need urgent medical attention. Follow this exact structure — do NOT deviate:
1. FIRST SENTENCE — always, for every emergency: "Please call 911 or go to the nearest emergency room right now."
2. SECOND SENTENCE — tell them ${nurseFirstForPrompt} has been notified (do NOT promise she will call back).
3. ${hasContact ? "End there — we already have their contact info." : `THIRD SENTENCE — ask: "So ${nurseFirstForPrompt} can reach you, what's the best phone number for you?"`}
End your reply with [[ALERT_NURSE]] on its own line.
Keep your response to these sentences only. Calm, clear, direct. Never use pet names — no "sweetie", "hun", "babe", "beautiful", or similar.`
      : "";

    // ── Pronoun-aware tone adjustment ─────────────────────────────────────
    const pronouns: string = typeof botConfig.pronouns === "string" ? botConfig.pronouns : "";
    const pronounToneBlock = pronouns === "He/Him"
      ? `\nCLIENT TONE PREFERENCE — He/Him: This client uses he/him pronouns. Use a direct, confident, matter-of-fact tone. Say "great choice", "solid results", "straightforward process". Skip "gorgeous", "beautiful", and 💕 emojis. Stay warm but efficient — like a knowledgeable friend, not a beauty consultant.`
      : pronouns === "They/Them"
      ? `\nCLIENT TONE PREFERENCE — They/Them: This client uses they/them pronouns. Use fully gender-neutral language. No "gorgeous", "beautiful", "girl", or gendered words. Warm, inclusive, and affirming. Avoid any assumptions about their identity.`
      : pronouns === "She/Her"
      ? `\nCLIENT TONE PREFERENCE — She/Her: This client uses she/her pronouns. Use warm, nurturing language. "Gorgeous", "beautiful", feminine affirmations and 💕 emojis are welcome.`
      : ""; // "Prefer not to say" or not set — use default tone

    const systemPrompt = `You are a warm, friendly assistant for ${botConfig.practice_name || "this aesthetic practice"} located in ${botConfig.city || "your area"}.

YOUR IDENTITY: Your name is ${effectiveBotName}. You are a virtual AI assistant — you are NOT the nurse.${nurseFirst ? ` Never say "I'm ${nurseFirst}" or claim to be the nurse personally. If asked who you are, say you are an AI assistant for ${nurseFirst}.` : " Never claim to be the nurse personally."} You are not a human.

Your role is a sales-psychology driven customer service assistant. You are NOT pushy. You guide people warmly toward booking.

SERVICES OFFERED: ${serviceNames.join(", ")}
${botConfig.location ? `LOCATION: ${botConfig.location}` : ""}

YOUR PERSONALITY:
- Warm, human, conversational — like a trusted friend who happens to know aesthetics
- Never use medical jargon. Say "tiny needle" not "cannula". Say "relaxer" not "neurotoxin". Say "safe gel" not "hyaluronic acid"
- Keep answers SHORT — 2-3 sentences max
- Always validate the client's feelings first before answering
- Use occasional emojis to feel warm and human
- Tone: ${botConfig.tone || "Warm & friendly"}${pronounToneBlock}

GREETING: Your opening message should feel completely unique to ${botConfig.practice_name} in ${botConfig.city}. Reference the specific services they offer. Never use a generic template greeting.

EARLY CONVERSATION:
In your very first message only — ask once and never again: "Have you seen our work before or is this your first time hearing about us?" If they say yes — skip ahead quickly to answering their questions and guiding them to book. If they say no or first time — warmly say: No worries! You can check out all our work on Instagram at ${botConfig.instagram || "our Instagram page"} — we post lots of before and afters there.${botConfig.facebook ? ` You can also find us on Facebook at ${botConfig.facebook}.` : ""}${botConfig.tiktok ? ` And follow us on TikTok at ${botConfig.tiktok} for fun videos!` : ""}${botConfig.website ? ` Our website is ${botConfig.website}.` : ""} Take a peek and come back with any questions! Once you have had a chance to look, I am here to help you book your spot 💕. IMPORTANT: Ask this question ONLY ONCE. If the client has already answered it or if you have already asked it, NEVER ask it again. Move forward with the conversation.

REFERRAL TRACKING: During the early conversation when you ask if they have seen the nurse's work before, if the client mentions where they found the practice or saw their work (Instagram, TikTok, Facebook, Google, a friend, etc.) — remember this. When you collect intake information, naturally ask: "By the way, how did you hear about us?" if they haven't already mentioned it. This helps the nurse know where her clients are coming from.

SALES PSYCHOLOGY RULES:
- People already WANT the procedure — they just need reassurance. Your job is to remove fear, not sell
- Never mention prices upfront. Build understanding of what they need first
- Only mention booking AFTER the client feels comfortable and asks about next steps or prices
- When someone asks about price say: "Pricing depends on exactly what you need — the total will vary based on your goals. ${botConfig.practice_name} will confirm the price with you before anything is done. Ready to book a consultation? 💕 ${botConfig.booking_link ? botConfig.booking_link : ""}"
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
${botConfig.aftercare ? `General aftercare: ${botConfig.aftercare}` : ""}
${procedureAftercareBlock ? `PROCEDURE-SPECIFIC AFTERCARE INSTRUCTIONS:\nWhen a client who has already booked or had a procedure asks about recovery or aftercare, refer to these instructions for accuracy:\n\n${procedureAftercareBlock}` : ""}
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

LANGUAGE: Respond in the same language the client is writing in. If the client writes in Spanish, respond entirely in Spanish. If they write in English, respond in English. Match their language naturally throughout the entire conversation.

Always speak in plain simple English (or Spanish if the client writes in Spanish). No medical terms. Be the warm voice that makes someone feel safe enough to take the next step.

FORMATTING RULES — CRITICAL: Never use markdown in your responses. No asterisks for bold (**text**), no bullet points (- item or * item), no headers (#). Write in plain conversational sentences only. Emojis are fine and encouraged.${activeOffersBlock}

SAFETY RULE — MEDICAL EMERGENCIES: If the client describes trouble breathing, chest pain, throat or tongue swelling, vision changes (blurry, double, or lost), skin turning white/gray/blue, fainting, severe or worsening pain, or any symptom that sounds like a medical emergency — OR if you find yourself advising them to call 911, go to the ER, or go to urgent care — respond in this exact order: (1) "Please call 911 or go to the nearest emergency room right now." (2) Tell them ${nurseFirstForPrompt} has been notified — do NOT promise she will call back. (3) If you do not already have their phone number, ask: "So ${nurseFirstForPrompt} can reach you, what's the best phone number for you?" Then append [[ALERT_NURSE]] on its own line at the very end. Never include [[ALERT_NURSE]] for routine questions.${emergencyInstruction}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1000,
        system: systemPrompt,
        messages: messages,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => `HTTP ${res.status}`);
      const aiSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await aiSupabase.from("message_log").insert({
        type: "ai_error",
        channel: "email",
        nurse_id: botConfig.nurse_id ?? null,
        status: "failed",
        error: errText.slice(0, 500),
      }).then(() => {}, () => {});
      return NextResponse.json({ reply: "I'm here to help! Could you tell me a little more?" });
    }

    const data = await res.json();
    const textBlock = Array.isArray(data.content)
      ? data.content.find((block: { type?: string; text?: string }) => block?.type === "text")
      : null;
    const rawReply = textBlock?.text || "I'm here to help! Could you tell me a little more?";

    // ── Strip [[ALERT_NURSE]] token ────────────────────────────────────────
    const aiAlertToken = rawReply.includes("[[ALERT_NURSE]]");
    const reply = rawReply.replace(/\[\[ALERT_NURSE\]\]\s*/g, "").trimEnd();

    // ── Server-side dedup (conversation-scoped) ──────────────────────────
    // "Same conversation" is identified by the message history the client sends:
    // previous user turns in THIS session. Two different clients are never confused.
    const normalizedCurrentMsg = normalizeText(lastUserMessage).slice(0, 200);

    // All normalized user messages already in this conversation (excluding the current one)
    const prevConvMsgs = (messages as { role: string; content: string }[])
      .filter((m) => m.role === "user")
      .slice(0, -1)
      .map((m) => normalizeText(m.content).slice(0, 200));

    let isDuplicateMessage = false;
    let isUpdate = false;
    let earlierAlertMsgs: string[] = [];

    if ((isFlagged || aiAlertToken) && botConfig.nurse_id) {
      try {
        const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const dedupDb = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { data: recentRows } = await dedupDb
          .from("message_log")
          .select("error, created_at")
          .eq("type", "emergency_alert")
          .eq("nurse_id", botConfig.nurse_id)
          .eq("status", "sent")
          .gte("created_at", twoHoursAgo)
          .order("created_at", { ascending: false });

        const rows = recentRows ?? [];

        // Dedup: skip only if (a) same text within 10 min AND (b) that text was already
        // in THIS conversation's history — prevents skipping a different client's alert.
        const msgWasAlreadyInConv = prevConvMsgs.includes(normalizedCurrentMsg);
        isDuplicateMessage = msgWasAlreadyInConv &&
          rows
            .filter((r) => r.created_at >= tenMinAgo)
            .some((r) => {
              const m = typeof r.error === "string" ? r.error.match(/\bmsg:(.+)$/) : null;
              return m != null && m[1] === normalizedCurrentMsg;
            });

        if (!isDuplicateMessage) {
          // UPDATE: an earlier message from THIS conversation was already alerted
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
        // Non-fatal — if dedup check fails, send the alert to be safe
        console.error("[chat-emergency] dedup check failed (proceeding):", dedupErr);
      }
    }

    // Log skip if exact duplicate within 10 min
    if (isDuplicateMessage && botConfig.nurse_id) {
      const skipDb = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      skipDb.from("message_log").insert({
        type: "emergency_alert",
        channel: "email",
        nurse_id: botConfig.nurse_id,
        status: "skipped",
        error: "duplicate within 10 min",
      }).then(() => {}, () => {});
      console.log("[chat-emergency] Duplicate message within 10 min — skipping alert");
    }

    // ── Alert decisions ────────────────────────────────────────────────────
    const shouldAlertKeyword = isFlagged && botConfig.nurse_id && !isDuplicateMessage;
    // AI alert fires only if keyword didn't already fire (and not a duplicate)
    const shouldAlertAI = aiAlertToken && !isFlagged && botConfig.nurse_id && !isDuplicateMessage;
    // Contact follow-up: keyword fired, we had an earlier no-contact alert, now have contact
    const isContactFollowUp = shouldAlertKeyword && alreadyAlertedWithoutContact && hasContact;

    // ── Keyword-triggered alert ───────────────────────────────────────────
    if (shouldAlertKeyword) {
      after(async () => {
        try {
          const db = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          const { data: botRow } = await db
            .from("bots")
            .select("alert_email, notification_email, alert_phone, practice_name")
            .eq("nurse_id", botConfig.nurse_id)
            .single();

          const noContact = !hasContact;

          const safeEmailHref = clientEmail?.trim() ? escapeHtml(clientEmail.trim()) : null;
          const safeEmailDisplay = clientEmail?.trim() ? escapeHtml(clientEmail.trim()) : null;

          // Fallback chain: alert_email → notification_email → auth email
          let alertEmail = (botRow as { alert_email?: string | null } | null)?.alert_email?.trim() || botRow?.notification_email?.trim() || null;
          if (!alertEmail) {
            try {
              const { data: authUser } = await db.auth.admin.getUserById(botConfig.nurse_id);
              alertEmail = authUser?.user?.email ?? null;
              if (alertEmail) console.log("[chat-emergency] no alert_email/notification_email — falling back to auth email");
              else console.warn(`[chat-emergency] No email found for nurse ${botConfig.nurse_id} — email skipped`);
            } catch (err) {
              console.error("[chat-emergency] Failed to fetch auth fallback email:", err);
            }
          } else {
            console.log("[chat-emergency] Sending alert to notification_email");
          }

          const practiceName = botRow?.practice_name || botConfig.practice_name || "your practice";
          const safeMsg = escapeHtml(lastUserMessage.slice(0, 500));
          const safeClient = clientName?.trim() ? escapeHtml(clientName.trim()) : null;
          const safePhone = clientPhone?.trim() ? escapeHtml(clientPhone.trim()) : null;
          const msgPreview = escapeHtml(lastUserMessage.slice(0, 60));

          const subject = isContactFollowUp
            ? emergencySubject(emergencyLevel ?? "nurse", `contact now available — ${practiceName}`)
            : emergencySubject(
                emergencyLevel ?? "nurse",
                noContact ? `no contact yet — ${practiceName}` : practiceName,
                isUpdate
              );

          const contactWarning = noContact
            ? `<div style="background:#fff7ed;border:2px solid #f97316;border-radius:8px;padding:12px;margin:16px 0;">
                <p style="margin:0;color:#c2410c;font-size:14px;font-weight:700;">⚠️ No contact info shared — they were told to call 911 / call you.</p>
              </div>`
            : "";

          const followUpNote = isContactFollowUp
            ? `<div style="background:#f0fdf4;border:2px solid #22c55e;border-radius:8px;padding:12px;margin:16px 0;">
                <p style="margin:0;color:#15803d;font-size:14px;font-weight:700;">✅ Contact info now available — client provided details after initial alert</p>
              </div>`
            : "";

          const updateSection = isUpdate && earlierAlertMsgs.length > 0
            ? `<div style="background:#fff7ed;border:1px solid #f97316;border-radius:8px;padding:12px;margin:16px 0;">
                <p style="margin:0 0 6px;color:#c2410c;font-size:13px;font-weight:700;">Earlier message(s) from this client:</p>
                ${earlierAlertMsgs.map((m) => `<p style="margin:0 0 4px;color:#92400e;font-size:13px;">&ldquo;${escapeHtml(m)}&rdquo;</p>`).join("")}
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
          ${updateSection}
          <div style="background:#f8fafc;border:2px solid #1a2744;border-radius:12px;padding:20px;margin:0 0 20px;">
            <p style="margin:0 0 12px;color:#1a2744;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Client contact info</p>
            <p style="margin:0 0 8px;color:#1a2744;font-size:17px;font-weight:700;">
              👤 ${safeClient ?? '<em style="color:#94a3b8;font-weight:400;font-size:15px;">Name not provided</em>'}
            </p>
            ${safePhone
              ? `<p style="margin:0 0 8px;color:#1a2744;font-size:17px;font-weight:700;">📱 ${phoneHtml(clientPhone!)}</p>`
              : `<p style="margin:0 0 8px;color:#94a3b8;font-style:italic;font-size:15px;">No phone provided</p>`}
            ${safeEmailDisplay
              ? `<p style="margin:0;color:#1a2744;font-size:17px;font-weight:700;">✉️ <a href="mailto:${safeEmailHref}" style="color:#1a2744;font-weight:700;">${safeEmailDisplay}</a></p>`
              : ""}
          </div>
          <p style="margin:0 0 8px;color:#1a2744;font-size:15px;">A client typed an emergency keyword in your AI chat bot:</p>
          <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:16px;margin:12px 0;">
            <p style="margin:0;color:#dc2626;font-size:15px;font-weight:600;">&ldquo;${safeMsg}&rdquo;</p>
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="https://www.adonisblue.io/dashboard" style="display:inline-block;background:#ef4444;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:50px;">View dashboard</a>
          </div>
          <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;">This alert was sent by AdonisBlue. The client is using your AI chat bot — not the healing chat.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

          await sendEmergencyAlert({
            nurseEmail: alertEmail,
            nurseId: botConfig.nurse_id,
            practiceName,
            type: "chat",
            subject,
            html: emailHtml,
            msgKey: normalizedCurrentMsg,
            supabase: db,
          });
          console.log("[chat-emergency] Keyword alert sent");

          // SMS
          const alertPhone = botRow?.alert_phone?.trim() || null;
          if (alertPhone) {
            const smsBody = noContact
              ? `AdonisBlue Alert: Emergency keyword in AI bot — no contact info yet. Check your email & dashboard.`
              : `AdonisBlue Alert: ${clientName || "Client"} (${clientPhone || "no phone"}) needs attention. Check your email & dashboard.`;
            await sendSms({
              type: "emergency_alert",
              nurse_id: botConfig.nurse_id,
              to: alertPhone,
              body: smsBody.slice(0, 160),
              supabase: db,
            });
            console.log("[chat-emergency] SMS sent");
          }
        } catch (alertErr) {
          console.error("[chat-emergency] Keyword alert failed (non-fatal):", alertErr);
          await logError("chat", `keyword alert failed: ${String(alertErr)}`);
        }
      });

      responseAlertedWithoutContact = !hasContact;
      console.log(`[chat-emergency] Keyword alert scheduled. hasContact=${hasContact}, isUpdate=${isUpdate}, isContactFollowUp=${isContactFollowUp}`);
    } else if (isFlagged && isDuplicateMessage) {
      console.log("[chat-emergency] Keyword detected but duplicate within 10 min — skipping");
    }

    // ── AI second alarm ────────────────────────────────────────────────────
    if (shouldAlertAI) {
      after(async () => {
        try {
          const db = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );
          const { data: botRow2 } = await db
            .from("bots")
            .select("alert_email, notification_email, alert_phone, practice_name")
            .eq("nurse_id", botConfig.nurse_id)
            .single();
          let alertEmail2 = (botRow2 as { alert_email?: string | null } | null)?.alert_email?.trim() || botRow2?.notification_email?.trim() || null;
          if (!alertEmail2) {
            const { data: authUser } = await db.auth.admin.getUserById(botConfig.nurse_id);
            alertEmail2 = authUser?.user?.email ?? null;
          }
          const practiceName2 = botRow2?.practice_name || botConfig.practice_name || "your practice";
          const safeClient2 = clientName?.trim() ? escapeHtml(clientName.trim()) : null;
          const safeEmailHref2 = clientEmail?.trim() ? escapeHtml(clientEmail.trim()) : null;
          const safeEmailDisplay2 = clientEmail?.trim() ? escapeHtml(clientEmail.trim()) : null;
          const subjectAI = emergencySubject(
            "nurse",
            isUpdate ? `same client — ${practiceName2} (AI-detected)` : `${practiceName2} (AI-detected)`,
            isUpdate
          );

          const updateSectionAI = isUpdate && earlierAlertMsgs.length > 0
            ? `<div style="background:#fff7ed;border:1px solid #f97316;border-radius:8px;padding:12px;margin:16px 0;">
                <p style="margin:0 0 6px;color:#c2410c;font-size:13px;font-weight:700;">Earlier message(s) from this client:</p>
                ${earlierAlertMsgs.map((m) => `<p style="margin:0 0 4px;color:#92400e;font-size:13px;">&ldquo;${escapeHtml(m)}&rdquo;</p>`).join("")}
              </div>`
            : "";

          await sendEmergencyAlert({
            nurseEmail: alertEmail2,
            nurseId: botConfig.nurse_id,
            practiceName: practiceName2,
            type: "chat",
            subject: subjectAI,
            html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#fef2f2;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:2px solid #ef4444;">
        <tr><td style="background:#ef4444;padding:24px 32px;text-align:center;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">⚠️ AI-Detected Emergency — Chat Bot</p>
          <p style="margin:6px 0 0;color:#fecaca;font-size:13px;">${escapeHtml(practiceName2)}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          ${updateSectionAI}
          <div style="background:#f8fafc;border:2px solid #1a2744;border-radius:12px;padding:20px;margin:0 0 20px;">
            <p style="margin:0 0 12px;color:#1a2744;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;">Client contact info</p>
            <p style="margin:0 0 8px;color:#1a2744;font-size:17px;font-weight:700;">
              👤 ${safeClient2 ?? '<em style="color:#94a3b8;font-weight:400;font-size:15px;">Name not provided</em>'}
            </p>
            ${clientPhone?.trim()
              ? `<p style="margin:0 0 8px;color:#1a2744;font-size:17px;font-weight:700;">📱 ${phoneHtml(clientPhone)}</p>`
              : `<p style="margin:0 0 8px;color:#94a3b8;font-style:italic;font-size:15px;">No phone provided</p>`}
            ${safeEmailDisplay2
              ? `<p style="margin:0;color:#1a2744;font-size:17px;font-weight:700;">✉️ <a href="mailto:${safeEmailHref2}" style="color:#1a2744;font-weight:700;">${safeEmailDisplay2}</a></p>`
              : ""}
          </div>
          <p style="margin:0 0 16px;color:#1a2744;font-size:15px;">The AI assistant flagged a potential emergency in your chat bot. The client's last message:</p>
          <div style="background:#fef2f2;border-left:4px solid #ef4444;border-radius:8px;padding:16px;margin:12px 0;">
            <p style="margin:0;color:#dc2626;font-size:15px;font-weight:600;">&ldquo;${escapeHtml(lastUserMessage.slice(0, 500))}&rdquo;</p>
          </div>
          <p style="margin:12px 0 0;color:#64748b;font-size:13px;">Alert source: AI token (keyword list did not match)</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#ef4444;color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:50px;">View dashboard</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
            msgKey: normalizedCurrentMsg,
            supabase: db,
          });
          console.log("[chat-ai-alert] AI alert sent");

          // SMS for AI alert too
          const alertPhone2 = botRow2?.alert_phone?.trim() || null;
          if (alertPhone2) {
            await sendSms({
              type: "emergency_alert",
              nurse_id: botConfig.nurse_id,
              to: alertPhone2,
              body: `AdonisBlue AI Alert: Client may need attention. Check your email & dashboard.`,
              supabase: db,
            });
          }
        } catch (aiAlertErr) {
          console.error("[chat-ai-alert] failed:", aiAlertErr);
          await logError("chat", `AI alert failed: ${String(aiAlertErr)}`);
        }
      });
      console.log("[chat-ai-alert] AI alarm scheduled");
    } else if (aiAlertToken && !isFlagged && isDuplicateMessage) {
      console.log("[chat-ai-alert] AI token but duplicate within 10 min — skipping");
    }

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

    // Save conversation to Supabase for insights and emergency flagging
    // Flag is set for keyword alerts AND AI-triggered alerts so they appear in bell/Secretary
    const shouldFlag = isFlagged || (aiAlertToken && !isDuplicateMessage);
    if (botConfig.nurse_id && messages.length >= 1) {
      try {
        const supabaseInsights = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        await supabaseInsights.from("conversations").insert({
          nurse_id: botConfig.nurse_id,
          bot_id: botConfig.bot_id || null,
          messages: messages,
          ...(shouldFlag && {
            flagged: true,
            flagged_message: lastUserMessage.slice(0, 500),
            client_name: clientName ?? null,
            client_phone: clientPhone ?? null,
            status: "active",
          }),
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
          pronouns: pronouns || null,
        }),
      }).catch(console.error);
    }

    const anyAlertFired = shouldAlertKeyword || shouldAlertAI;

    // Server always controls the reply for emergency cases.
    // Keyword path: alert fires in after() so we include "I've alerted" unconditionally
    // (the after() WILL send it — the async delay is invisible to the client).
    // AI-only path: also nurse level, alertSent=false (fires after response).
    let finalReply = reply;
    if (isFlagged && emergencyLevel) {
      finalReply = buildEmergencyReply(emergencyLevel, nurseFirst || null, nurseAlertPhone, shouldAlertKeyword);
    } else if (aiAlertToken && !isFlagged) {
      finalReply = buildEmergencyReply("nurse", nurseFirst || null, nurseAlertPhone, false);
    }

    return NextResponse.json({
      reply: finalReply,
      // Kept for client backward compat; server no longer gates on emergencyAlertedThisSession
      emergencyAlerted: anyAlertFired ? true : undefined,
      emergencyAlertedWithoutContact: responseAlertedWithoutContact,
    });
  } catch (e) {
    await logError("chat", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
