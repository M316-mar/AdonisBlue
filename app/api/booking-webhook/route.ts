import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// NOTE: Rate limiting is instance-local. For multi-instance deployments,
// replace this Map with a Redis-backed counter (e.g. Upstash Redis).
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_CHARS = /[^0-9\s\+\-\(\)]/g;

// Fields that must never be stored — payment / financial data
const BLOCKED_FIELDS = new Set([
  "price", "amount", "revenue", "payment", "charge", "cost", "total",
]);

interface NormalizedBooking {
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  service_name: string | null;
  appointment_date: string | null;
}

interface BotRow {
  nurse_id: string;
  practice_name: string | null;
  booking_link: string | null;
}

function isBlocked(key: string): boolean {
  return BLOCKED_FIELDS.has(key.toLowerCase());
}

function safeString(val: unknown): string {
  return typeof val === "string" ? val : "";
}

// Attempt to parse a date value into YYYY-MM-DD
function parseDate(raw: unknown): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // Already ISO YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];

  // Try Date constructor for other formats like "2024-06-15T10:00:00Z" or "06/15/2024"
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeBody(source: string, body: Record<string, any>): NormalizedBooking {
  // Strip any payment/financial fields before processing
  for (const key of Object.keys(body)) {
    if (isBlocked(key)) delete body[key];
  }

  switch (source) {
    case "vagaro": {
      const c = body.client ?? {};
      const svc = body.service ?? {};
      const appt = body.appointment ?? {};
      return {
        client_name:
          `${safeString(c.first_name || body.first_name)} ${safeString(c.last_name || body.last_name)}`.trim() ||
          safeString(body.client_name || body.name),
        client_email: safeString(c.email || body.email || body.client_email) || null,
        client_phone: safeString(c.phone || body.phone || body.client_phone) || null,
        service_name: safeString(svc.name || body.service_name || body.service) || null,
        appointment_date: parseDate(appt.start_time || body.appointment_date || body.date || body.start_at),
      };
    }
    case "jane": {
      const p = body.patient ?? {};
      return {
        client_name:
          `${safeString(p.first_name || body.first_name)} ${safeString(p.last_name || body.last_name)}`.trim() ||
          safeString(body.client_name || body.name),
        client_email: safeString(p.email || body.email || body.client_email) || null,
        client_phone: safeString(p.phone || body.phone || body.client_phone) || null,
        service_name: safeString(body.treatment_name || body.service_name || body.service) || null,
        appointment_date: parseDate(body.start_at || body.appointment_date || body.date),
      };
    }
    case "square": {
      const c2 = body.customer ?? {};
      const appt2 = body.appointment ?? {};
      const svcName =
        safeString(appt2.service_name || body.service_name || body.service) ||
        (Array.isArray(appt2.segment_types) && appt2.segment_types.length > 0
          ? safeString(appt2.segment_types[0]?.service_variation_data?.name ?? appt2.segment_types[0]?.name)
          : null) ||
        null;
      return {
        client_name:
          `${safeString(c2.given_name || body.first_name)} ${safeString(c2.family_name || body.last_name)}`.trim() ||
          safeString(body.client_name || body.name),
        client_email: safeString(c2.email_address || body.email || body.client_email) || null,
        client_phone: safeString(c2.phone_number || body.phone || body.client_phone) || null,
        service_name: svcName,
        appointment_date: parseDate(appt2.start_at || body.appointment_date || body.date || body.start_at),
      };
    }
    case "acuity": {
      return {
        client_name:
          `${safeString(body.firstName || body.first_name)} ${safeString(body.lastName || body.last_name)}`.trim() ||
          safeString(body.client_name || body.name),
        client_email: safeString(body.email || body.client_email) || null,
        client_phone: safeString(body.phone || body.client_phone) || null,
        service_name: safeString(body.type || body.service_name || body.service) || null,
        appointment_date: parseDate(body.datetime || body.appointment_date || body.date || body.start_at),
      };
    }
    case "mindbody": {
      const c3 = body.Client ?? {};
      return {
        client_name:
          `${safeString(c3.FirstName || body.first_name)} ${safeString(c3.LastName || body.last_name)}`.trim() ||
          safeString(body.client_name || body.name),
        client_email: safeString(c3.Email || body.email || body.client_email) || null,
        client_phone: safeString(c3.MobilePhone || body.phone || body.client_phone) || null,
        service_name: safeString(body.Name || body.service_name || body.service) || null,
        appointment_date: parseDate(body.StartDateTime || body.appointment_date || body.date || body.start_at),
      };
    }
    default: {
      // Generic: try common field names
      const name =
        safeString(body.name || body.first_name || body.client_name || body.full_name) || "";
      const lastName = safeString(body.last_name || body.lastName || "");
      const clientName = lastName ? `${name} ${lastName}`.trim() : name.trim();

      const email =
        safeString(body.email || body.client_email || body.email_address || "") || null;
      const phone =
        safeString(body.phone || body.client_phone || body.phone_number || "") || null;
      const service =
        safeString(
          body.service || body.service_name || body.type || body.treatment || body.treatment_name || ""
        ) || null;
      const date = parseDate(
        body.date ??
          body.appointment_date ??
          body.start_at ??
          body.datetime ??
          body.start_time ??
          null
      );

      return { client_name: clientName, client_email: email, client_phone: phone, service_name: service, appointment_date: date };
    }
  }
}

function checkRateLimit(secret: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(secret);
  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    rateLimitMap.set(secret, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count += 1;
  return true;
}

// GET — lets curl / browser verify the endpoint is alive without a secret.
// Returns a 200 so it's clear the route is reachable and not being redirected.
export function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "booking-webhook",
    method_required: "POST",
    note: "Send a POST request with ?secret=YOUR_SECRET&source=vagaro|jane|square|acuity|mindbody|generic",
  });
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const secret = url.searchParams.get("secret") ?? "";
    const source = url.searchParams.get("source") ?? "generic";

    // ── Ping / connectivity test ───────────────────────────────────────────
    // Hit ?ping=1 to confirm the route is reached and no middleware is
    // intercepting it. Safe to call without a real secret.
    if (url.searchParams.get("ping") === "1") {
      return NextResponse.json({ ok: true, source: "webhook", reached: true });
    }

    // Validate secret
    if (!secret || secret.length > 200) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }

    // Rate limit
    if (!checkRateLimit(secret)) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Look up nurse by webhook secret
    const { data: bot } = await supabase
      .from("bots")
      .select("nurse_id, practice_name, booking_link")
      .eq("webhook_secret", secret)
      .single();

    if (!bot) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }


    const botRow = bot as BotRow;

    // Parse body
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rawBody: Record<string, any> = {};
    try {
      rawBody = await request.json();
    } catch {
      rawBody = {};
    }

    const normalized = normalizeBody(source, rawBody);

    // Validate client_name (required)
    const clientName = normalized.client_name.trim().slice(0, 100);
    if (!clientName) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Validate email
    let clientEmail: string | null = null;
    if (normalized.client_email) {
      const e = normalized.client_email.trim().slice(0, 254).toLowerCase();
      if (EMAIL_REGEX.test(e)) clientEmail = e;
    }

    // Sanitize phone
    let clientPhone: string | null = null;
    if (normalized.client_phone) {
      const p = normalized.client_phone.replace(PHONE_CHARS, "").slice(0, 20).trim();
      if (p) clientPhone = p;
    }

    // Sanitize service name
    const serviceName = normalized.service_name
      ? normalized.service_name.trim().slice(0, 200) || null
      : null;

    // Parse appointment date
    const appointmentDate = normalized.appointment_date;

    // Upsert into intakes
    let intakeId: string | null = null;

    if (clientEmail) {
      // Try to find existing intake for this nurse+email
      const { data: existing } = await supabase
        .from("intakes")
        .select("id")
        .eq("nurse_id", botRow.nurse_id)
        .eq("email", clientEmail)
        .single();

      if (existing) {
        intakeId = existing.id as string;
        // Update intake record
        await supabase
          .from("intakes")
          .update({
            first_name: clientName,
            phone: clientPhone ?? undefined,
            service_interested: serviceName ?? undefined,
            came_via_booking: true,
          })
          .eq("id", intakeId);
      } else {
        const { data: newIntake } = await supabase
          .from("intakes")
          .insert({
            nurse_id: botRow.nurse_id,
            first_name: clientName,
            email: clientEmail,
            phone: clientPhone,
            service_interested: serviceName,
            came_via_booking: true,
            came_via_bot: false,
          })
          .select("id")
          .single();
        intakeId = newIntake?.id ?? null;
      }
    } else {
      // No email — always insert
      const { data: newIntake } = await supabase
        .from("intakes")
        .insert({
          nurse_id: botRow.nurse_id,
          first_name: clientName,
          phone: clientPhone,
          service_interested: serviceName,
          came_via_booking: true,
          came_via_bot: false,
        })
        .select("id")
        .single();
      intakeId = newIntake?.id ?? null;
    }


    // Insert treatment record if we have intake_id and appointment_date — but only if
    // this exact appointment hasn't already been recorded (booking platforms commonly
    // fire the same webhook event more than once: on create, update, reminder, etc.)
    if (intakeId && appointmentDate) {
      const { data: existingTreatment } = await supabase
        .from("treatments")
        .select("id")
        .eq("nurse_id", botRow.nurse_id)
        .eq("intake_id", intakeId)
        .eq("treatment_date", appointmentDate)
        .eq("procedure_name", serviceName ?? "Booking appointment")
        .maybeSingle();

      if (!existingTreatment) {
        await supabase.from("treatments").insert({
          nurse_id: botRow.nurse_id,
          intake_id: intakeId,
          procedure_name: serviceName ?? "Booking appointment",
          treatment_date: appointmentDate,
          came_via_bot: false,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Booking webhook error:", e);
    return NextResponse.json({ ok: false, debug: String(e) }, { status: 500 });
  }
}
