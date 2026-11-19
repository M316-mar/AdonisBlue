import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logError";
import { buildIcs } from "@/lib/calendarLinks";
import { checkRateLimit, serviceClient, getClientIp } from "@/lib/rateLimit";
import { dueDate, formatDueDate, personalReminderSendDate } from "@/lib/reminderDate";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ treatment_id: string }> },
) {
  const { treatment_id } = await params;

  if (!treatment_id || !UUID_REGEX.test(treatment_id)) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Rate-limit: 10 downloads per IP per 10 minutes
  const ip = getClientIp(request);
  const sb = serviceClient();
  const allowed = await checkRateLimit(sb, `ics:${ip}`, 10);
  if (!allowed) {
    return new NextResponse("Too many requests", { status: 429 });
  }

  try {
    const { data: treatment, error } = await sb
      .from("treatments")
      .select(`
        id,
        treatment_date,
        nurse_id,
        intake_id,
        procedure_id,
        procedure_name,
        planned_return_at,
        reminder_lead_days,
        return_reason,
        procedures(name, reminder_days),
        bots!treatments_nurse_id_fkey(practice_name, nurse_name, booking_link, rebooking_link)
      `)
      .eq("id", treatment_id)
      .maybeSingle();

    if (error) {
      await logError("calendar-event", error.message);
      return new NextResponse("Server error", { status: 500 });
    }
    if (!treatment) {
      return new NextResponse("Not found", { status: 404 });
    }

    // Resolve due date
    let eventDate: string;
    const hasPersonalPlan =
      (treatment as any).planned_return_at != null &&
      (treatment as any).reminder_lead_days != null;

    if (hasPersonalPlan) {
      eventDate = (treatment as any).planned_return_at as string;
    } else {
      const reminderDays: number | null =
        (treatment.procedures as any)?.reminder_days ?? null;
      if (!reminderDays) {
        return new NextResponse("Not found", { status: 404 });
      }
      eventDate = dueDate(treatment.treatment_date, reminderDays)
        .toISOString()
        .slice(0, 10);
    }

    const bot = Array.isArray((treatment as any).bots)
      ? (treatment as any).bots[0]
      : (treatment as any).bots;

    const practiceName: string = bot?.practice_name || "your provider";
    const nurseFirstName: string =
      ((bot?.nurse_name as string | null) || practiceName).split(" ")[0]!;

    const procedureName: string =
      (treatment.procedures as any)?.name ||
      treatment.procedure_name ||
      "your treatment";
    const returnReason: string | null =
      (treatment as any).return_reason ?? null;

    const bookingLink: string | null =
      bot?.rebooking_link || bot?.booking_link || null;

    const eventTitle = `Book my visit with ${nurseFirstName}`;
    const descParts = [returnReason || procedureName];
    if (bookingLink) descParts.push(`Book at: ${bookingLink}`);

    const ics = buildIcs({
      date: eventDate,
      title: eventTitle,
      description: descParts.join("\n"),
    });

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="book-visit.ics"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    await logError("calendar-event", String(e));
    return new NextResponse("Server error", { status: 500 });
  }
}
