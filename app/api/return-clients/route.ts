import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logError";
import { dueDate, reminderSendDate } from "@/lib/reminderDate";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getToken(request: Request): string | null {
  return request.headers.get("authorization")?.replace("Bearer ", "").trim() || null;
}

async function getUser(token: string) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await sb.auth.getUser(token);
  return user;
}

export async function GET(request: Request) {
  try {
    const token = getToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch non-archived, non-rebooked treatments with a procedure that has reminder_days
    const { data: treatments, error: tErr } = await supabase
      .from("treatments")
      .select("id, treatment_date, procedure_id, procedure_name, intake_id, rebooked_at, rebooked_source, procedures(name, reminder_days), intakes(first_name, email, marketing_opt_out)")
      .eq("nurse_id", user.id)
      .eq("archived", false)
      .not("procedure_id", "is", null);

    if (tErr) {
      await logError("return-clients", tErr.message);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const thirtyDaysOut = new Date(today);
    thirtyDaysOut.setUTCDate(today.getUTCDate() + 30);

    // Keep only the most recent treatment per (intake_id, procedure_id)
    const mostRecentMap = new Map<string, typeof treatments[0]>();
    for (const t of treatments ?? []) {
      const key = `${t.intake_id}:${t.procedure_id}`;
      const existing = mostRecentMap.get(key);
      if (!existing || new Date(t.treatment_date) > new Date(existing.treatment_date)) {
        mostRecentMap.set(key, t);
      }
    }

    type ReturnClient = {
      treatment_id: string;
      intake_id: string;
      client_name: string;
      procedure_name: string;
      due_date: string;
      reminder_send_date: string;
      rebooked_at: string | null;
      rebooked_source: string | null;
      opted_out: boolean;
    };

    const clients: ReturnClient[] = [];

    for (const t of mostRecentMap.values()) {
      const reminderDays = (t.procedures as any)?.reminder_days as number | null;
      if (!reminderDays) continue;

      const due = dueDate(t.treatment_date, reminderDays);
      if (isNaN(due.getTime())) {
        await logError("return-clients", `invalid treatment_date for treatment ${t.id}: "${t.treatment_date}"`);
        continue;
      }
      const sendOn = reminderSendDate(due);

      // Show if due within 30 days from today (or already past due but not rebooked)
      // Also show recently rebooked (within 7 days) so nurse sees the green card
      if (t.rebooked_at) {
        const rebookedDate = new Date(t.rebooked_at);
        if (isNaN(rebookedDate.getTime())) continue;
        const daysSinceRebooked = (today.getTime() - rebookedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceRebooked > 7) continue; // green card expires after 7 days
      } else {
        // Yellow: show if due date is within 30 days OR already past due
        if (due > thirtyDaysOut) continue;
      }

      const intake = Array.isArray(t.intakes) ? t.intakes[0] : t.intakes;
      const clientName = (intake as any)?.first_name || "Client";
      const optedOut = !!(intake as any)?.marketing_opt_out;

      clients.push({
        treatment_id: t.id,
        intake_id: t.intake_id,
        client_name: clientName,
        procedure_name: (t.procedures as any)?.name || t.procedure_name || "treatment",
        due_date: due.toISOString().slice(0, 10),
        reminder_send_date: sendOn.toISOString().slice(0, 10),
        rebooked_at: t.rebooked_at ?? null,
        rebooked_source: t.rebooked_source ?? null,
        opted_out: optedOut,
      });
    }

    // Sort: rebooked (green) last, then by due_date ascending
    clients.sort((a, b) => {
      if (!!a.rebooked_at !== !!b.rebooked_at) return a.rebooked_at ? 1 : -1;
      return a.due_date.localeCompare(b.due_date);
    });

    return NextResponse.json({ clients });
  } catch (e) {
    await logError("return-clients", String(e));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const token = getToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json() as { treatment_id?: string; action?: string };
    const { treatment_id, action } = body;

    if (!treatment_id || !UUID_REGEX.test(treatment_id)) {
      return NextResponse.json({ error: "Invalid treatment_id" }, { status: 400 });
    }
    if (action !== "booked" && action !== "unbook") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify ownership before updating
    const { data: existing, error: fetchErr } = await supabase
      .from("treatments")
      .select("id, nurse_id")
      .eq("id", treatment_id)
      .eq("nurse_id", user.id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const update = action === "booked"
      ? { rebooked_at: new Date().toISOString(), rebooked_source: "nurse" }
      : { rebooked_at: null, rebooked_source: null };

    const { error: updateErr } = await supabase
      .from("treatments")
      .update(update)
      .eq("id", treatment_id);

    if (updateErr) {
      await logError("return-clients", updateErr.message);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    await logError("return-clients", String(e));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
