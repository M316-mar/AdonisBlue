/**
 * Shared email builders for client return reminders and the nurse "clients coming back" email.
 * Used by the cron routes AND the preview script — edit here, not in the routes.
 */

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";

// ── 1. Client treatment-reminder email (treatment-reminders cron) ─────────────

export function buildTreatmentReminderEmail({
  clientName,
  practiceName,
  bookingLink,
  procedureName,
  reminderDays,
  slug,
  intakeId,
}: {
  clientName: string;
  practiceName: string;
  bookingLink: string | null;
  procedureName: string;
  reminderDays: number;
  slug: string | null;
  intakeId: string;
}) {
  const bookingSection = bookingLink
    ? `<div style="background:#f0fdf4;border-radius:14px;padding:20px;margin:20px 0;text-align:center;">
            <p style="margin:0 0 12px;color:#1a2744;font-size:15px;font-weight:600;">Ready to refresh your look? ✨</p>
            <a href="${bookingLink}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:50px;">Book my appointment 💙</a>
          </div>`
    : `<div style="background:#f0fdf4;border-radius:14px;padding:20px;margin:20px 0;text-align:center;">
            <p style="margin:0;color:#1a2744;font-size:15px;font-weight:600;">Ready to refresh your look? ✨</p>
            <p style="margin:8px 0 0;color:#475569;font-size:14px;">Reply to this email or contact ${practiceName} to book your appointment.</p>
          </div>`;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#1a2744;padding:28px 32px;text-align:center;">
          <img src="${SITE_URL}/Alona.png" alt="AdonisBlue" width="44" height="44" style="border-radius:10px;display:block;margin:0 auto 10px;" />
          <span style="color:#fff;font-size:18px;font-weight:600;">${practiceName}</span>
        </td></tr>
        <tr><td style="padding:36px 32px;">
          <h1 style="margin:0 0 8px;color:#1a2744;font-size:22px;font-weight:600;">Hey ${clientName}, time for a refresh? 💙</h1>
          <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">It's been ${reminderDays} days since your <strong>${procedureName}</strong> — which means it's the perfect time to book your next appointment and keep looking and feeling your best!</p>
          ${bookingSection}
          <p style="margin:0;color:#94a3b8;font-size:13px;text-align:center;">We can't wait to see you again! 💕</p>
        </td></tr>
        ${slug ? `<tr>
          <td style="background:#f0fdfa;padding:24px 32px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0 0 12px;color:#1a2744;font-size:14px;font-weight:600;">Have concerns or questions?</p>
            <a href="https://www.adonisblue.io/chat/${slug}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:999px;font-size:14px;font-weight:600;">💬 Chat with ${practiceName}'s assistant</a>
            <p style="margin:12px 0 0;color:#94a3b8;font-size:12px;">Anything urgent will notify ${practiceName} to reach out to you right away.</p>
          </td>
        </tr>` : ""}
        <tr><td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0 0 6px;color:#94a3b8;font-size:12px;">Sent with care by ${practiceName} via AdonisBlue</p>
          <p style="margin:0;color:#cbd5e1;font-size:11px;"><a href="${SITE_URL}/api/unsubscribe?id=${intakeId}" style="color:#cbd5e1;text-decoration:underline;">Unsubscribe from reminders</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ── 2. Client 6/9-month backup reminder email (reminders cron) ───────────────

export function buildBackupReminderEmail({
  clientName,
  practiceName,
  bookingLink,
  months,
  intakeId,
}: {
  clientName: string;
  practiceName: string;
  bookingLink: string | null;
  months: number;
  intakeId: string;
}) {
  const is6 = months === 6;
  const headline = is6
    ? `Your results are fading, ${clientName} — and we miss you 💕`
    : `${clientName}, it's been 9 months. Your glow is ready for a refresh ✨`;
  const body1 = is6
    ? `It's been about 6 months since your last appointment at ${practiceName} — which means your filler is naturally starting to soften. This is actually the perfect time to come back for a touch up before it fully fades.`
    : `Nine months in, and your results have done their job beautifully. But the best version of your look? It's one appointment away. Coming back now means your nurse can build on what's already there — not start from scratch.`;
  const body2 = is6
    ? `Most clients say their 6-month touch up is their favorite appointment — it's subtle, quick, and keeps you looking effortlessly fresh. No one will know. They'll just think you look amazing.`
    : `Your lips, cheeks, or wherever you last treated — they're ready. And so are we. Don't let the work fade completely. A small refresh now goes a long way.`;
  const ctaHtml = bookingLink
    ? `<a href="${bookingLink}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:50px;">Book my touch up 💕</a>`
    : `<p style="color:#0d9488;font-size:15px;font-weight:600;">Reply to this email or contact ${practiceName} to book your appointment 💕</p>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Time to glow again</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#1a2744;padding:28px 32px;text-align:center;">
          <img src="${SITE_URL}/Alona.png" alt="AdonisBlue" width="44" height="44" style="border-radius:10px;display:block;margin:0 auto 10px;" />
          <span style="color:#ffffff;font-size:18px;font-weight:600;">${practiceName}</span>
        </td></tr>
        <tr><td style="padding:36px 32px;">
          <h1 style="margin:0 0 16px;color:#1a2744;font-size:22px;font-weight:600;line-height:1.3;">${headline}</h1>
          <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">${body1}</p>
          <p style="margin:0 0 28px;color:#475569;font-size:15px;line-height:1.7;">${body2}</p>
          ${ctaHtml}
        </td></tr>
        <tr><td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0 0 6px;color:#94a3b8;font-size:12px;">Sent with care by ${practiceName} via AdonisBlue</p>
          <p style="margin:0;color:#cbd5e1;font-size:11px;"><a href="${SITE_URL}/api/unsubscribe?id=${intakeId}" style="color:#cbd5e1;text-decoration:underline;">Unsubscribe from reminders</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

// ── 3. Nurse "clients coming back" weekly email (return-reminder cron) ────────

export function buildNurseReturnEmail({
  practiceName,
  clients,
}: {
  practiceName: string;
  clients: Array<{ clientName: string; procedureName: string; dueFormatted: string }>;
}) {
  const clientLines = clients
    .map(
      (c) =>
        `<p style="margin:0 0 10px;font-size:15px;color:#334155;">🟡 <strong>${c.clientName}</strong> is due back for ${c.procedureName} around ${c.dueFormatted}.</p>`
    )
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr><td style="background:#1a2744;padding:24px 32px;">
          <img src="${SITE_URL}/Alona.png" alt="AdonisBlue" width="36" height="36" style="border-radius:8px;display:block;margin:0 auto 8px;" />
          <p style="margin:0;color:#fff;font-size:18px;font-weight:700;text-align:center;">🔁 Clients coming back soon</p>
          <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;text-align:center;">${practiceName} · Save them a spot this week.</p>
        </td></tr>
        <tr><td style="padding:32px;">
          ${clientLines}
          <div style="margin-top:20px;text-align:center;">
            <a href="${SITE_URL}/dashboard" style="display:inline-block;background:#0d9488;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:50px;">View dashboard 💙</a>
          </div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">AdonisBlue · hi@adonisblue.io</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
