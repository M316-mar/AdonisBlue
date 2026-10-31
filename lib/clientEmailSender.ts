/**
 * getClientSender — resolves the "from" display name and reply-to for
 * client-facing emails (aftercare, check-in, reminders, review requests).
 *
 * from_name: sanitized practice_name (strip quotes, angle brackets, line
 *   breaks; max 60 chars; fallback "AdonisBlue").
 * reply_to: alert_email when alert_email_verified is true, else
 *   notification_email when set, else undefined (omit from send call).
 */
export function sanitizeFromName(raw: string | null | undefined): string {
  if (!raw) return "AdonisBlue";
  const cleaned = raw
    .replace(/["'`]/g, "")
    .replace(/[<>]/g, "")
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, 60)
    .trim();
  return cleaned || "AdonisBlue";
}

export function getClientSender(bot: {
  practice_name?: string | null;
  alert_email?: string | null;
  alert_email_verified?: boolean | null;
  notification_email?: string | null;
}): { from_name: string; reply_to: string | undefined } {
  const from_name = sanitizeFromName(bot.practice_name);
  const reply_to =
    bot.alert_email_verified && bot.alert_email
      ? bot.alert_email
      : bot.notification_email
      ? bot.notification_email
      : undefined;
  return { from_name, reply_to };
}
