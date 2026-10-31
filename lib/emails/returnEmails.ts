/**
 * Shared email builders for client return reminders and the nurse "clients coming back" email.
 * Used by the cron routes AND the preview script — edit here, not in the routes.
 */

import { dueDate, formatDueDate } from "@/lib/reminderDate";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://adonisblue.io";

// ── Shared email header ───────────────────────────────────────────────────────
// Logo on the LEFT (if provided), AdonisBlue butterfly on the RIGHT.
// Table-based so it renders correctly in Gmail, Apple Mail and Outlook.

export function buildEmailHeader({
  practiceName,
  logoUrl,
}: {
  practiceName: string;
  logoUrl?: string | null;
}) {
  const leftCell = logoUrl
    ? `<img src="${logoUrl}" alt="${practiceName}" height="40" style="max-height:40px;max-width:160px;display:block;object-fit:contain;" />`
    : `<span style="color:#fff;font-size:16px;font-weight:600;">${practiceName}</span>`;

  return `<tr>
  <td style="background:#1a2744;padding:20px 24px;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:middle;">${leftCell}</td>
        <td style="vertical-align:middle;text-align:right;width:48px;">
          <img src="${SITE_URL}/Alona.png" alt="AdonisBlue" width="36" height="36" style="border-radius:8px;display:block;margin-left:auto;" />
        </td>
      </tr>
    </table>
  </td>
</tr>`;
}

// ── 1. Client treatment-reminder email (treatment-reminders cron) ─────────────

export function buildTreatmentReminderEmail({
  clientName,
  practiceName,
  logoUrl,
  bookingLink,
  procedureName,
  treatmentDate,
  reminderDays,
  slug,
  intakeId,
}: {
  clientName: string;
  practiceName: string;
  logoUrl?: string | null;
  bookingLink: string | null;
  procedureName: string;
  treatmentDate: string;
  reminderDays: number;
  slug: string | null;
  intakeId: string;
}) {
  const due = dueDate(treatmentDate, reminderDays);
  const dueDateStr = formatDueDate(due);

  const bookingSection = bookingLink
    ? `<div style="background:#f0fdf4;border-radius:14px;padding:20px;margin:20px 0;text-align:center;">
          <a href="${bookingLink}" style="display:inline-block;background:#0d9488;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:50px;">Book my appointment 💙</a>
        </div>`
    : `<div style="background:#f0fdf4;border-radius:14px;padding:20px;margin:20px 0;text-align:center;">
          <p style="margin:0;color:#1a2744;font-size:15px;font-weight:600;">Ready to book?</p>
          <p style="margin:8px 0 0;color:#475569;font-size:14px;">Reply to this email or contact ${practiceName} to book your appointment.</p>
        </div>`;

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e2e8f0;">
        ${buildEmailHeader({ practiceName, logoUrl })}
        <tr><td style="padding:36px 32px;">
          <h1 style="margin:0 0 8px;color:#1a2744;font-size:22px;font-weight:600;">Hey ${clientName} 💙</h1>
          <p style="margin:0 0 16px;color:#475569;font-size:15px;line-height:1.7;">Your <strong>${procedureName}</strong> is due for a refresh around <strong>${dueDateStr}</strong>. Book now to get a time that works for you.</p>
          ${bookingSection}
        </td></tr>
        ${slug ? `<tr>
          <td style="background:#f0fdfa;padding:24px 32px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0 0 12px;color:#1a2744;font-size:14px;font-weight:600;">Have concerns or questions?</p>
            <a href="https://www.adonisblue.io/chat/${slug}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:999px;font-size:14px;font-weight:600;">💬 Chat with ${practiceName}'s assistant</a>
            <p style="margin:12px 0 0;color:#94a3b8;font-size:12px;">Anything urgent sends an alert to ${practiceName} immediately.</p>
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

// ── 2. Nurse "clients coming back" weekly email (return-reminder cron) ────────

export function buildNurseReturnEmail({
  practiceName,
  logoUrl,
  clients,
}: {
  practiceName: string;
  logoUrl?: string | null;
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
        ${buildEmailHeader({ practiceName, logoUrl })}
        <tr><td style="padding:24px 32px 8px;">
          <p style="margin:0 0 6px;color:#1a2744;font-size:18px;font-weight:700;">🔁 Clients coming back soon</p>
          <p style="margin:0 0 20px;color:#64748b;font-size:13px;">Save them a spot this week.</p>
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

