/**
 * Shared reminder-date helpers.
 * Both the treatment-reminders cron and the "coming back soon" dashboard card
 * use these so they always agree on timing.
 */

import { parseTreatmentDate } from "@/lib/formatTreatmentDate";

/**
 * Date the client is due back (treatment_date + reminder_days).
 *
 * Works entirely in UTC so day-count arithmetic is DST-safe.
 * Accepts both "YYYY-MM-DD" and full timestamptz values such as
 * "2026-10-21 00:00:00+00" — the YYYY-MM-DD portion is extracted first.
 */
export function dueDate(treatmentDateStr: string, reminderDays: number): Date {
  const local = parseTreatmentDate(treatmentDateStr);
  if (!local) return new Date(NaN);
  const d = new Date(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
  d.setUTCDate(d.getUTCDate() + reminderDays);
  return d;
}

/** Date we send the client reminder email (due_date − 14 days). */
export function reminderSendDate(due: Date): Date {
  const d = new Date(due);
  d.setUTCDate(d.getUTCDate() - 14);
  return d;
}

/**
 * Format a due Date (UTC midnight, from dueDate()) for display in emails.
 * Always uses timeZone: "UTC" so the day never shifts on the server.
 * Returns "soon" for invalid dates.
 */
export function formatDueDate(
  due: Date,
  options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" }
): string {
  if (isNaN(due.getTime())) return "soon";
  return due.toLocaleDateString("en-US", { timeZone: "UTC", ...options });
}

/**
 * Returns true when today falls in the send window:
 *   today >= reminderSendDate(due) AND today <= due + 7 days
 * AND reminder_sent is still false AND rebooked_at is null.
 *
 * "today" is a Date with time zeroed to UTC midnight.
 */
export function inReminderWindow(due: Date, today: Date): boolean {
  const sendOn = reminderSendDate(due);
  const cutoff = new Date(due);
  cutoff.setUTCDate(cutoff.getUTCDate() + 7);
  return today >= sendOn && today <= cutoff;
}
