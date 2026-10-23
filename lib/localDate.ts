/**
 * Returns "YYYY-MM-DD" in the browser's (or server's) LOCAL timezone.
 * Use this everywhere a date input or comparison needs "today" to mean
 * the calendar date the nurse sees on her clock, not the UTC date.
 *
 * Never use new Date().toISOString().slice(0, 10) for this — that gives
 * the UTC date, which is one day behind for anyone west of UTC after 18:00.
 */
export function localDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
