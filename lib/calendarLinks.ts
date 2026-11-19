/**
 * Shared calendar link builders for nurse dashboard and client emails.
 * All-day events only. No client health details, phone, or email in event fields.
 */

/** Escape a string for use inside an .ics field value. */
export function icsEscape(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/** Format YYYY-MM-DD → YYYYMMDD for all-day DTSTART/DTEND. */
function icsDate(dateStr: string): string {
  return dateStr.replace(/-/g, "");
}

export interface CalendarEvent {
  /** YYYY-MM-DD */
  date: string;
  title: string;
  description: string;
  /** Optional 7-day advance display alarm (nurse use). */
  alarm?: string;
}

// ── URL builders ──────────────────────────────────────────────────────────────

export function googleCalendarUrl(event: CalendarEvent): string {
  const d = icsDate(event.date);
  // All-day: dates use YYYYMMDD/YYYYMMDD+1 format
  const next = nextDayStr(event.date);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${d}/${icsDate(next)}`,
    details: event.description,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function outlookWebUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: event.title,
    startdt: event.date,
    enddt: nextDayStr(event.date),
    body: event.description,
    allday: "true",
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function yahooCalendarUrl(event: CalendarEvent): string {
  const d = icsDate(event.date);
  const params = new URLSearchParams({
    v: "60",
    title: event.title,
    st: `${d}T000000Z`,
    et: `${icsDate(nextDayStr(event.date))}T000000Z`,
    desc: event.description,
    dur: "allday",
  });
  return `https://calendar.yahoo.com/?${params.toString()}`;
}

// ── .ics builder ──────────────────────────────────────────────────────────────

export function buildIcs(event: CalendarEvent): string {
  const d = icsDate(event.date);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AdonisBlue//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `DTSTART;VALUE=DATE:${d}`,
    `DTEND;VALUE=DATE:${icsDate(nextDayStr(event.date))}`,
    `SUMMARY:${icsEscape(event.title)}`,
    `DESCRIPTION:${icsEscape(event.description)}`,
    `UID:adonisblue-${d}-${encodeURIComponent(event.title.slice(0, 20))}@adonisblue.io`,
  ];
  if (event.alarm) {
    lines.push(
      "BEGIN:VALARM",
      "TRIGGER:-P7D",
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsEscape(event.alarm)}`,
      "END:VALARM",
    );
  }
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

/** data: URI for inline download (nurse dashboard — no server round-trip). */
export function icsDataUri(event: CalendarEvent): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(buildIcs(event))}`;
}

// ── Helper ────────────────────────────────────────────────────────────────────

function nextDayStr(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
