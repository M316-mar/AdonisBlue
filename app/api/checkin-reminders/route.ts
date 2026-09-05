import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function authClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getUser(token: string) {
  const { data: { user } } = await authClient().auth.getUser(token);
  return user;
}

function getToken(request: Request) {
  return request.headers.get("authorization")?.replace("Bearer ", "").trim() || null;
}

// Monday–Sunday of the current week (UTC dates as YYYY-MM-DD)
function thisWeekRange(): { monday: string; sunday: string } {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { monday: fmt(monday), sunday: fmt(sunday) };
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const a = new Date(from + "T00:00:00Z").getTime();
  const b = new Date(to + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86400000);
}

export async function GET(request: Request) {
  try {
    const token = getToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = serviceClient();
    const { monday, sunday } = thisWeekRange();
    const today = todayUTC();

    // Fetch this week's reminders
    const { data: reminders, error: remErr } = await db
      .from("checkin_reminders")
      .select("*")
      .eq("nurse_id", user.id)
      .gte("due_date", monday)
      .lte("due_date", sunday)
      .order("due_date", { ascending: true });

    if (remErr) return NextResponse.json({ error: remErr.message }, { status: 500 });

    if (!reminders || reminders.length === 0) {
      return NextResponse.json({ reminders: [], total: 0, done: 0 });
    }

    // Fetch practice name for script substitution
    const { data: botRow } = await db
      .from("bots")
      .select("practice_name")
      .eq("nurse_id", user.id)
      .maybeSingle();
    const practiceName = botRow?.practice_name ?? "your provider";

    // Collect treatment IDs and intake IDs to batch-fetch
    const treatmentIds = [...new Set(reminders.map((r: any) => r.treatment_id).filter(Boolean))];
    const intakeIds = [...new Set(reminders.map((r: any) => r.intake_id).filter(Boolean))];

    const [treatmentsRes, intakesRes] = await Promise.all([
      treatmentIds.length > 0
        ? db.from("treatments").select("id, treatment_date, procedure_name, procedure_id").in("id", treatmentIds)
        : Promise.resolve({ data: [] }),
      intakeIds.length > 0
        ? db.from("intakes").select("id, first_name, phone").in("id", intakeIds)
        : Promise.resolve({ data: [] }),
    ]);

    const treatmentMap = new Map((treatmentsRes.data ?? []).map((t: any) => [t.id, t]));
    const intakeMap = new Map((intakesRes.data ?? []).map((i: any) => [i.id, i]));

    // Fetch procedures for checkin_script
    const procedureIds = [...new Set(
      (treatmentsRes.data ?? []).map((t: any) => t.procedure_id).filter(Boolean)
    )];
    const procedureMap = new Map<string, { checkin_script: string | null; name: string }>();
    if (procedureIds.length > 0) {
      const { data: procs } = await db
        .from("procedures")
        .select("id, name, checkin_script")
        .in("id", procedureIds);
      for (const p of procs ?? []) procedureMap.set(p.id, p);
    }

    const built = reminders.map((r: any) => {
      const treatment = treatmentMap.get(r.treatment_id) ?? null;
      const intake = intakeMap.get(r.intake_id) ?? null;
      const procedure = treatment?.procedure_id ? procedureMap.get(treatment.procedure_id) ?? null : null;

      const clientName = intake?.first_name ?? "your client";
      const procedureName = treatment?.procedure_name ?? "your treatment";
      const rawScript = procedure?.checkin_script
        ?? `Hi {client}, this is {practice} calling to check in after your ${procedureName}. How are you feeling? Let us know if anything feels concerning.`;

      const script = rawScript
        .replace(/\{client\}/g, clientName)
        .replace(/\{practice\}/g, practiceName);

      const treatmentDate = treatment?.treatment_date ?? today;
      const daysSince = daysBetween(treatmentDate, today);

      return {
        id: r.id,
        client_name: clientName,
        phone: intake?.phone ?? null,
        procedure_name: procedureName,
        days_since: daysSince,
        due_date: r.due_date,
        status: r.status,
        note: r.note ?? null,
        script,
      };
    });

    const total = built.length;
    const done = built.filter((r: any) => r.status === "done").length;

    return NextResponse.json({ reminders: built, total, done });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const token = getToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id || !UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    const action = body.action as string;
    if (!["complete", "no_answer", "note"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const db = serviceClient();

    // Verify ownership
    const { data: existing } = await db
      .from("checkin_reminders")
      .select("id, due_date, nurse_id")
      .eq("id", id)
      .maybeSingle();

    if (!existing || existing.nurse_id !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    let patch: Record<string, unknown> = { updated_at: now };

    if (action === "complete") {
      patch.status = "done";
      patch.completed_at = now;
      if (typeof body.note === "string" && body.note.trim()) {
        patch.note = body.note.trim().slice(0, 2000);
      }
    } else if (action === "no_answer") {
      patch.due_date = addDays(existing.due_date, 3);
    } else if (action === "note") {
      if (typeof body.note === "string") {
        patch.note = body.note.trim().slice(0, 2000);
      }
    }

    const { data: updated, error } = await db
      .from("checkin_reminders")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ reminder: updated });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
