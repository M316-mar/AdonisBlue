import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logError";
import { dueDate, reminderSendDate, personalReminderSendDate } from "@/lib/reminderDate";

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

    // Fetch non-archived treatments (include multi-procedure treatments where procedure_id may be null)
    const { data: treatments, error: tErr } = await supabase
      .from("treatments")
      .select("id, treatment_date, procedure_id, procedure_name, intake_id, rebooked_at, rebooked_source, planned_return_at, return_reason, reminder_lead_days, planned_reminder_sent_at, procedures(name, reminder_days), intakes(first_name, email, marketing_opt_out)")
      .eq("nurse_id", user.id)
      .eq("archived", false);

    if (tErr) {
      await logError("return-clients", tErr.message);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const thirtyDaysOut = new Date(today);
    thirtyDaysOut.setUTCDate(today.getUTCDate() + 30);

    // Batch-fetch junction procedures for all treatment IDs
    const allTreatmentIdsRC = (treatments ?? []).map((t) => t.id);
    type JunctionRowRC = { treatment_id: string; procedure_id: string; procedure_name: string; sort_order: number; procedures: { name: string; reminder_days: number | null } | { name: string; reminder_days: number | null }[] | null };
    const { data: junctionRowsRC } = allTreatmentIdsRC.length > 0
      ? await supabase
          .from("treatment_procedures")
          .select("treatment_id, procedure_id, procedure_name, sort_order, procedures(name, reminder_days)")
          .in("treatment_id", allTreatmentIdsRC)
          .order("sort_order", { ascending: true })
      : { data: [] as JunctionRowRC[] };
    const junctionByTreatmentRC = new Map<string, JunctionRowRC[]>();
    for (const r of (junctionRowsRC ?? []) as unknown as JunctionRowRC[]) {
      if (!junctionByTreatmentRC.has(r.treatment_id)) junctionByTreatmentRC.set(r.treatment_id, []);
      junctionByTreatmentRC.get(r.treatment_id)!.push(r);
    }

    // Keep only the most recent treatment per (intake_id, procedure set)
    const mostRecentMap = new Map<string, typeof treatments[0]>();
    for (const t of treatments ?? []) {
      const jProcs = junctionByTreatmentRC.get(t.id) ?? [];
      const keyProcPart = jProcs.length > 0
        ? jProcs.map((p) => p.procedure_id).sort().join(",")
        : (t.procedure_id ?? "");
      if (!keyProcPart) continue; // skip treatments with no procedures at all
      const key = `${t.intake_id}:${keyProcPart}`;
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
      return_reason: string | null;
      has_personal_plan: boolean;
      personal_reminder_sent: boolean;
    };

    const clients: ReturnClient[] = [];

    for (const t of mostRecentMap.values()) {
      const hasPersonalPlan = (t as any).planned_return_at != null && (t as any).reminder_lead_days != null;

      let dueStr: string;
      let sendOnStr: string;

      if (hasPersonalPlan) {
        const plannedAt: string = (t as any).planned_return_at;
        const leadDays: number = (t as any).reminder_lead_days;
        dueStr = plannedAt;
        sendOnStr = personalReminderSendDate(plannedAt, leadDays).toISOString().slice(0, 10);
      } else {
        const jProcsRC = junctionByTreatmentRC.get(t.id) ?? [];
        const reminderDaysArrRC = jProcsRC.length > 0
          ? jProcsRC.map((p) => (p.procedures as any)?.reminder_days as number | null | undefined).filter((d): d is number => d != null)
          : [];
        const reminderDays: number | null = reminderDaysArrRC.length > 0
          ? Math.min(...reminderDaysArrRC)
          : ((t.procedures as any)?.reminder_days as number | null);
        if (!reminderDays) continue;
        const due = dueDate(t.treatment_date, reminderDays);
        if (isNaN(due.getTime())) {
          await logError("return-clients", `invalid treatment_date for treatment ${t.id}: "${t.treatment_date}"`);
          continue;
        }
        dueStr = due.toISOString().slice(0, 10);
        sendOnStr = reminderSendDate(due).toISOString().slice(0, 10);
      }

      // Show if due within 30 days (or already past), or recently rebooked
      if (t.rebooked_at) {
        const rebookedDate = new Date(t.rebooked_at);
        if (isNaN(rebookedDate.getTime())) continue;
        const daysSinceRebooked = (today.getTime() - rebookedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceRebooked > 7) continue;
      } else {
        if (dueStr > thirtyDaysOut.toISOString().slice(0, 10)) continue;
      }

      const intake = Array.isArray(t.intakes) ? t.intakes[0] : t.intakes;
      const clientName = (intake as any)?.first_name || "Client";
      const optedOut = !!(intake as any)?.marketing_opt_out;

      clients.push({
        treatment_id: t.id,
        intake_id: t.intake_id,
        client_name: clientName,
        procedure_name: (() => {
          const jProcsRCName = junctionByTreatmentRC.get(t.id) ?? [];
          return jProcsRCName.length > 0
            ? jProcsRCName.map((p) => (p.procedures as any)?.name || p.procedure_name).join(" + ")
            : ((t.procedures as any)?.name || t.procedure_name || "treatment");
        })(),
        due_date: dueStr,
        reminder_send_date: sendOnStr,
        rebooked_at: t.rebooked_at ?? null,
        rebooked_source: t.rebooked_source ?? null,
        opted_out: optedOut,
        return_reason: (t as any).return_reason ?? null,
        has_personal_plan: hasPersonalPlan,
        personal_reminder_sent: (t as any).planned_reminder_sent_at != null,
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
