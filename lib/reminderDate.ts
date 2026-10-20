/**
 * Shared reminder-date helpers.
 * Both the treatment-reminders cron and the "coming back soon" dashboard card
 * use these so they always agree on timing.
 */

/** Date the client is due back (treatment_date + reminder_days). */
export function dueDate(treatmentDateISO: string, reminderDays: number): Date {
  const d = new Date(treatmentDateISO + "T00:00:00Z");
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
