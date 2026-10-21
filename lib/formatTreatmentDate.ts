/**
 * Parse a treatment_date value safely, extracting the calendar date without
 * any timezone shifting. The column is TIMESTAMPTZ but always stores midnight
 * UTC (e.g. "2026-10-21 00:00:00+00" or "2026-10-21T00:00:00Z"). Feeding the
 * raw string into `new Date()` shifts it to local time and can move the day
 * back by one. Instead we extract the YYYY-MM-DD portion and build a local
 * midnight Date so the displayed day is always the stored calendar date.
 */
export function parseTreatmentDate(dateStr: string | null | undefined): Date | null {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/** Format for display. Returns "Date not recorded" when the value is absent or unparseable. */
export function formatTreatmentDate(
  dateStr: string | null | undefined,
  options: Intl.DateTimeFormatOptions
): string {
  const d = parseTreatmentDate(dateStr);
  return d ? d.toLocaleDateString("en-US", options) : "Date not recorded";
}
