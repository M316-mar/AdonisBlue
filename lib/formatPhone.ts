/**
 * Format a phone number for client-facing display without changing stored data.
 *
 * 10-digit US numbers (after stripping non-digits):  "(214) 717-7944"
 * 11-digit US numbers starting with 1:               "(214) 717-7944"
 * Anything else:                                      returned as-is
 */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw?.trim()) return raw ?? "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return raw;
}

/**
 * Wrap a phone number in a tappable <a href="tel:..."> link for email HTML.
 * Uses formatPhone() for the visible text.
 * Phone numbers contain only safe characters — no HTML escaping needed.
 */
export function phoneHtml(raw: string | null | undefined): string {
  if (!raw?.trim()) return raw ?? "";
  const digits = raw.replace(/\D/g, "");
  const display = formatPhone(raw);
  // Use E.164 href: +1XXXXXXXXXX for US, else raw digits
  const href =
    digits.length === 10
      ? `+1${digits}`
      : digits.length === 11 && digits[0] === "1"
      ? `+${digits}`
      : digits || raw;
  return `<a href="tel:${href}" style="color:inherit;font-weight:600;text-decoration:underline;">${display}</a>`;
}
