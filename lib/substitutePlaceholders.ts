/**
 * Replace [YOUR NAME] and [YOUR PHONE] template placeholders with the nurse's
 * real name and phone number before any text reaches a client email or SMS.
 *
 * Call this on aftercare_instructions immediately before building the email
 * HTML — never send the raw DB value to a client.
 */
export function substitutePlaceholders(
  text: string,
  nurseName: string,
  nursePhone: string
): string {
  return text
    .replace(/\[YOUR NAME\]/g, nurseName || "[YOUR NAME]")
    .replace(/\[YOUR PHONE\]/g, nursePhone || "[YOUR PHONE]");
}

/** True when the text still has an unresolved placeholder. */
export function hasUnresolvedPlaceholders(text: string): boolean {
  return /\[YOUR (NAME|PHONE)\]/i.test(text);
}
