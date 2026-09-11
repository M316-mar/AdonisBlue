import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getUser(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return null;
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await anon.auth.getUser(token);
  return user ?? null;
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function daysFromNow(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = serviceClient();
    const today = todayUTC();
    const in7Days = daysFromNow(7);
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const [treatmentsRes, incidentsRes, checkinsRes] = await Promise.all([
      // 1. Upcoming prep reminders: treatments in next 7 days where prep not sent yet
      db
        .from("treatments")
        .select(`
          id,
          procedure_name,
          treatment_date,
          intake_id,
          intakes (
            id,
            first_name,
            email,
            prep_guide_sent
          )
        `)
        .eq("nurse_id", user.id)
        .eq("archived", false)
        .gte("treatment_date", today)
        .lte("treatment_date", in7Days)
        .not("intake_id", "is", null),

      // 2. Flagged incidents in last 48 hours — from both healing_chats and conversations
      Promise.all([
        db
          .from("healing_chats")
          .select("id, client_name, client_phone, flagged_message, updated_at")
          .eq("nurse_id", user.id)
          .eq("flagged", true)
          .eq("status", "active")
          .gte("updated_at", fortyEightHoursAgo),
        db
          .from("conversations")
          .select("id, client_name, client_phone, flagged_message, created_at")
          .eq("nurse_id", user.id)
          .eq("flagged", true)
          .eq("status", "active")
          .gte("created_at", fortyEightHoursAgo),
      ]),

      // 3. Check-ins due today, status pending
      db
        .from("checkin_reminders")
        .select("id, client_name, due_date")
        .eq("nurse_id", user.id)
        .eq("due_date", today)
        .eq("status", "pending"),
    ]);

    // Build upcomingPrepReminders — filter out already-sent and missing email
    const upcomingPrepReminders = (treatmentsRes.data ?? [])
      .filter((t: any) => {
        const intake = Array.isArray(t.intakes) ? t.intakes[0] : t.intakes;
        return intake && intake.email && !intake.prep_guide_sent;
      })
      .map((t: any) => {
        const intake = Array.isArray(t.intakes) ? t.intakes[0] : t.intakes;
        return {
          treatment_id: t.id,
          intake_id: intake.id,
          client_name: intake.first_name ?? "Client",
          treatment_date: t.treatment_date,
          procedure_name: t.procedure_name ?? "",
        };
      });

    // Build flaggedIncidents from both sources
    const [healingRes, chatRes] = incidentsRes;
    const flaggedIncidents = [
      ...(healingRes.data ?? []).map((r: any) => ({
        id: r.id,
        client_name: r.client_name ?? null,
        client_phone: r.client_phone ?? null,
        flagged_message: r.flagged_message ?? null,
        created_at: r.updated_at,
      })),
      ...(chatRes.data ?? []).map((r: any) => ({
        id: r.id,
        client_name: r.client_name ?? null,
        client_phone: r.client_phone ?? null,
        flagged_message: r.flagged_message ?? null,
        created_at: r.created_at,
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const checkinsToday = (checkinsRes.data ?? []).map((r: any) => ({
      id: r.id,
      client_name: r.client_name ?? "Client",
      due_date: r.due_date,
    }));

    return NextResponse.json({ upcomingPrepReminders, flaggedIncidents, checkinsToday });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
