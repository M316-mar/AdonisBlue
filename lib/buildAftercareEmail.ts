/**
 * Shared aftercare email HTML builder.
 * Used by both /api/send-aftercare (preview) and /api/cron/send-due-aftercare (send).
 *
 * Layout rules:
 * - Greeting: "Hi {firstName}! 💙" (no first name: "Hi there! 💙")
 * - Subtext about the visit
 * - Chat button near the top (links to /healing/{treatmentId})
 * - ONE procedure: full aftercare content in email
 * - TWO+ procedures: compact cards (name + 2-sentence preview + "See more" link)
 * - Emergency line always present
 * - Chat button repeated at bottom
 * - Gmail-friendly: no JS, no forms, plain links only
 */

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Extract the first maxSentences sentences from plain text.
 * Cuts at a sentence-ending punctuation (. ? !) followed by whitespace or end-of-string.
 * Never cuts mid-word.
 */
export function previewSentences(text: string, maxSentences = 2): string {
  const trimmed = text.trim();
  // Match sentence-ending punctuation followed by whitespace or end
  const sentenceEnd = /[.?!](?:\s|$)/g;
  let count = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = sentenceEnd.exec(trimmed)) !== null) {
    count++;
    lastIndex = match.index + match[0].length;
    if (count >= maxSentences) break;
  }
  if (lastIndex > 0) {
    return trimmed.slice(0, lastIndex).trim();
  }
  // No sentence boundary found — return first 200 chars ending at a word boundary
  const chunk = trimmed.slice(0, 200);
  const wordEnd = chunk.lastIndexOf(" ");
  return wordEnd > 0 ? chunk.slice(0, wordEnd) + "…" : chunk;
}

export interface AftercareProcedure {
  name: string;
  /** Already-substituted safe HTML for the full content */
  contentHtml: string;
  /** URL-encoded procedure name for the ?tab= param */
  tabParam: string;
}

export interface AftercareEmailOptions {
  clientFirstName: string;
  escapedPracticeName: string;
  treatmentId: string;
  procedures: AftercareProcedure[];
  /** Nurse first name for the emergency line */
  nurseFirstName: string;
  /** Nurse phone for the emergency line, or "" */
  nursePhone: string;
  siteUrl: string;
}

function chatButton(href: string, label: string): string {
  return `<div style="text-align:center;margin:20px 0;">
            <a href="${href}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:50px;">${label}</a>
          </div>`;
}

function emergencyLine(nurseFirstName: string, nursePhone: string): string {
  const contactPart = nursePhone
    ? ` at ${escapeHtml(nursePhone)}`
    : "";
  return `<div style="background:#fff1f2;border-radius:14px;padding:16px 20px;margin:20px 0;border-left:4px solid #f43f5e;">
            <p style="margin:0;color:#9f1239;font-size:13px;line-height:1.6;">
              <strong>If anything feels wrong, contact ${escapeHtml(nurseFirstName)} right away${contactPart}.</strong>
              Trouble breathing or vision changes: call 911.
            </p>
          </div>`;
}

export function buildAftercareEmail(opts: AftercareEmailOptions): string {
  const {
    clientFirstName,
    escapedPracticeName,
    treatmentId,
    procedures,
    nurseFirstName,
    nursePhone,
    siteUrl,
  } = opts;

  const greeting = clientFirstName
    ? `Hi ${escapeHtml(clientFirstName)}! \u{1F499}`
    : "Hi there! \u{1F499}";

  const healingUrl = `${siteUrl}/healing/${treatmentId}`;

  const topChatButton = chatButton(
    healingUrl,
    "\u{1F4AC} Questions? Chat with us anytime →"
  );

  let contentHtml: string;

  if (procedures.length === 1) {
    // Single procedure: full content in email
    const p = procedures[0]!;
    contentHtml = `
          <div style="background:#f0fdf4;border-radius:14px;padding:20px;margin:16px 0;border-left:4px solid #0d9488;">
            <h3 style="margin:0 0 10px;color:#0d9488;font-size:15px;font-weight:600;">&#128203; ${escapeHtml(p.name)} Aftercare</h3>
            <p style="margin:0;color:#1a2744;font-size:14px;line-height:1.75;white-space:pre-wrap;">${p.contentHtml}</p>
          </div>`;
  } else {
    // Multiple procedures: compact cards with 2-sentence preview + in-email expand.
    // <details>/<summary> gives a native toggle in Apple Mail / iPhone Mail.
    // Gmail strips <details> but keeps its inner content — so the full aftercare
    // text is ALWAYS present in the HTML and never hidden from Gmail readers.
    const cards = procedures.map((p) => {
      // Strip HTML tags for the plain-text preview
      const plainText = p.contentHtml.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      const preview = escapeHtml(previewSentences(plainText, 2));
      return `
          <div style="background:#f8fafc;border-radius:14px;padding:16px 20px;margin:12px 0;border:1px solid #e2e8f0;">
            <h3 style="margin:0 0 6px;color:#0d9488;font-size:14px;font-weight:600;">&#128203; ${escapeHtml(p.name)}</h3>
            <p style="margin:0 0 10px;color:#475569;font-size:13px;line-height:1.65;">${preview}</p>
            <details style="margin:0;">
              <summary style="display:inline-block;min-height:44px;line-height:44px;background:#1a2744;color:#ffffff;font-size:12px;font-weight:600;text-decoration:none;padding:0 18px;border-radius:50px;cursor:pointer;list-style:none;">See full aftercare ↓</summary>
              <div style="margin-top:12px;color:#1a2744;font-size:14px;line-height:1.75;white-space:pre-wrap;">${p.contentHtml}</div>
            </details>
          </div>`;
    });
    contentHtml = cards.join("");
  }

  const bottomChatBlock = `
          <div style="background:#1a2744;border-radius:14px;padding:20px;margin:20px 0;text-align:center;">
            <p style="margin:0 0 8px;color:#ffffff;font-size:15px;font-weight:600;">Have recovery questions? \u{1F499}</p>
            <p style="margin:0 0 12px;color:#94a3b8;font-size:13px;">Our 24/7 recovery chat is here for you.</p>
            <a href="${healingUrl}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:50px;">\u{1F4AC} Open recovery chat</a>
          </div>`;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#1a2744;padding:28px 32px;text-align:center;">
          <img src="${siteUrl}/Alona.png" alt="AdonisBlue" width="44" height="44" style="border-radius:10px;display:block;margin:0 auto 10px;" />
          <span style="color:#fff;font-size:18px;font-weight:600;">${escapedPracticeName}</span>
        </td></tr>
        <tr><td style="padding:36px 32px;">
          <h1 style="margin:0 0 8px;color:#1a2744;font-size:22px;font-weight:600;">${greeting}</h1>
          <p style="margin:0 0 20px;color:#475569;font-size:14px;">Here are your aftercare tips from today&#39;s visit. We know your day can get busy, but we&#39;re here for you.</p>
          ${topChatButton}
          ${contentHtml}
          ${emergencyLine(nurseFirstName, nursePhone)}
          ${bottomChatBlock}
        </td></tr>
        <tr><td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">Sent with care by ${escapedPracticeName} via AdonisBlue</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
