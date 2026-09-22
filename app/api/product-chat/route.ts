import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const SYSTEM_PROMPT = `You are the AI assistant for AdonisBlue, a software company that builds AI-powered front desk tools for solo aesthetic nurse injectors. You are answering questions from people visiting the AdonisBlue website or who found this link through social media — they are potential customers (nurse injectors), not clients of a medical practice. You are a live demo of AdonisBlue's own technology, so be warm, quick, and genuinely helpful — the way you handle this conversation is the pitch.

WHAT ADONISBLUE DOES: Gives a solo nurse injector's clients a 24/7 AI front desk that answers common questions, so the nurse isn't juggling her phone mid-appointment. It also automatically sends aftercare instructions after treatments, follow-up check-in reminders, and review requests — built around one core idea: most practices lose clients not because of bad work, but because the client felt unheard or unanswered afterward.

PRICING: $85/month, Starter plan. AdonisBlue is currently running a limited beta program — 5 spots, free for the first month, with a discounted rate afterward for beta participants.

HOW TO GET STARTED: Direct them to adonisblue.io/beta to apply for a beta spot.

CONTACT: If someone wants to reach a real person directly, share hi@adonisblue.io.

ADDRESS REAL CONCERNS DIRECTLY, don't just reassure vaguely:
- "I'm not techy" → AdonisBlue is built to need zero technical skill; Valentina personally helps every beta member get set up.
- "I already use Vagaro/Jane/Square" → AdonisBlue works alongside existing booking software, not instead of it — it doesn't replace what they already use.
- "I have a small practice" → Built specifically for solo injectors, not large multi-provider clinics.
- "Does this replace me or my nurse?" → No — it answers common questions and handles follow-up, but never replaces the real relationship or clinical judgment. Real concerns always go to a human.
- "Is this HIPAA compliant?" → Be honest and careful here: say that AdonisBlue takes data privacy seriously and that Valentina can speak directly to specific compliance questions — do not make a firm HIPAA compliance claim.

WHEN TO HAND OFF INSTEAD OF ANSWERING: If a question is complex, a custom request, pricing negotiation, or anything you're not fully certain about, don't guess. Say warmly that you'll have Valentina follow up personally, and ask for their name and the best way to reach them (email or Instagram handle). Once you have that, say clearly: "Got it, I'll make sure Valentina reaches out to you directly."

WHAT THIS BOT IS NOT: Does not collect health information, does not book appointments, does not act as a medical intake — exists only to answer questions about the AdonisBlue product itself.

FORMATTING: Never use markdown. No asterisks, no bullet points, no headers. Plain conversational sentences only. Emojis are fine.`;

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Configuration error" }, { status: 500 });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("[product-chat] Anthropic API error:", res.status, JSON.stringify(data));
    }

    // Claude Sonnet 5 can return multiple content blocks (e.g. a "thinking" block
    // before the actual "text" block) — find the real text block rather than
    // assuming it's always at index 0.
    const textBlock = Array.isArray(data.content)
      ? data.content.find((block: { type?: string; text?: string }) => block?.type === "text")
      : null;

    const reply: string = textBlock?.text
      || (() => {
        console.error("[product-chat] No text block found in Anthropic response:", JSON.stringify(data));
        return "I'm here! What can I tell you about AdonisBlue?";
      })();

    // Handoff detection — fire-and-forget email to hi@adonisblue.io
    const handoffTriggered = reply.toLowerCase().includes("valentina reaches out to you directly");
    if (handoffTriggered) {
      void (async () => {
        try {
          // Scan last few messages for name and contact info
          const recentMessages = (messages as { role: string; content: string }[]).slice(-6);
          const visitorLines = recentMessages
            .map((m) => `${m.role === "user" ? "Visitor" : "AdonisBlue"}: ${m.content}`)
            .join("\n");

          // Look for an email or Instagram handle in visitor messages
          const visitorText = recentMessages
            .filter((m) => m.role === "user")
            .map((m) => m.content)
            .join(" ");

          const emailMatch = visitorText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
          const igMatch = visitorText.match(/@[\w.]{1,30}/);
          const contact = emailMatch?.[0] ?? igMatch?.[0] ?? "not provided";

          const safeContact = escapeHtml(contact);
          const safeConvo = escapeHtml(visitorLines);

          await resend.emails.send({
            from: "AdonisBlue <hi@adonisblue.io>",
            to: "hi@adonisblue.io",
            subject: "🙋 Someone wants to talk — product chat handoff",
            html: `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#1a2744;padding:24px 32px;text-align:center;">
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700;">🙋 Product Chat Handoff</p>
          <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">Someone wants Valentina to follow up</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1a2744;">Contact info provided:</p>
          <p style="margin:0 0 20px;font-size:16px;font-weight:600;color:#0d9488;">${safeContact}</p>
          <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#1a2744;">Conversation context:</p>
          <pre style="margin:0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;font-size:13px;color:#334155;white-space:pre-wrap;word-break:break-word;">${safeConvo}</pre>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
          });
          console.log("[product-chat] Handoff email sent. Contact:", contact);
        } catch (err) {
          console.error("[product-chat] Handoff email failed:", err);
        }
      })();
    }

    return NextResponse.json({ reply });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
