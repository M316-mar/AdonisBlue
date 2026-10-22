import { phoneHtml } from "./formatPhone";

/**
 * Replace [YOUR NAME] and [YOUR PHONE] placeholders for plain-text contexts
 * (e.g. SMS). For HTML email, use substitutePlaceholdersSafeHtml instead.
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

/**
 * HTML-safe version for email: escapes the raw text first, then replaces
 * [YOUR NAME] with the escaped name and [YOUR PHONE] with a formatted
 * tappable tel: link. The returned string is safe to interpolate directly
 * into email HTML — callers must NOT wrap it in escapeHtml() again.
 */
export function substitutePlaceholdersSafeHtml(
  text: string,
  nurseName: string,
  nursePhone: string
): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
  // [YOUR NAME] and [YOUR PHONE] survive escaping (brackets are not HTML-special)
  const withName = escaped.replace(
    /\[YOUR NAME\]/g,
    nurseName
      ? nurseName.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      : "[YOUR NAME]"
  );
  return withName.replace(
    /\[YOUR PHONE\]/g,
    nursePhone ? phoneHtml(nursePhone) : "[YOUR PHONE]"
  );
}

/** True when the text still has an unresolved placeholder. */
export function hasUnresolvedPlaceholders(text: string): boolean {
  return /\[YOUR (NAME|PHONE)\]/i.test(text);
}
