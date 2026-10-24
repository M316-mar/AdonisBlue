import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { promoteScheduledAftercares } from "@/lib/promoteScheduledAftercares";
import { logError } from "@/lib/logError";

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

export async function GET(request: Request) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = serviceClient();
    await promoteScheduledAftercares(db);

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [hcRes, cvRes, unsentRes, scheduledRes, checkinRes, prepRes] = await Promise.all([
      // 1. Unhandled alerts from healing_chats — no age filter
      //    Join to treatments → intakes to get the real first name when client_name is blank or "Client"
      db
        .from("healing_chats")
        .select("id, client_name, client_phone, flagged_message, updated_at, treatment_id, alert_level, alert_messages, treatments(intake_id, intakes(first_name, email))")
        .eq("nurse_id", user.id)
        .eq("flagged", true)
        .eq("status", "active")
        .order("updated_at", { ascending: false }),

      // 2. Unhandled alerts from front-desk chatbot — no age filter
      db
        .from("conversations")
        .select("id, client_name, client_phone, flagged_message, created_at")
        .eq("nurse_id", user.id)
        .eq("flagged", true)
        .eq("status", "active")
        .order("created_at", { ascending: false }),

      // 3. Aftercare to send: last 3 days, not archived, nurse intended to send, not yet sent or scheduled
      db
        .from("treatments")
        .select("id, treatment_date, procedure_name, procedure_id, intake_id, intakes(first_name)")
        .eq("nurse_id", user.id)
        .eq("archived", false)
        .eq("send_aftercare", true)
        .is("aftercare_sent_at", null)
        .is("aftercare_send_at", null)
        .gte("treatment_date", threeDaysAgo)
        .not("intake_id", "is", null),

      // 4. Scheduled aftercares (send_aftercare=true, not yet delivered)
      db
        .from("treatments")
        .select("id, procedure_name, intake_id, aftercare_send_at, intakes(first_name)")
        .eq("nurse_id", user.id)
        .eq("archived", false)
        .not("aftercare_send_at", "is", null)
        .is("aftercare_sent_at", null)
        .not("intake_id", "is", null),

      // 5. Check-ins due or overdue (due_date <= today, not done) — missed ones stay until done
      db
        .from("checkin_reminders")
        .select("id, due_date, intake_id, intakes(id, first_name)")
        .eq("nurse_id", user.id)
        .lte("due_date", today)
        .neq("status", "done"),

      // 6. Prep reminders: strictly FUTURE appointments within 7 days (guide not yet sent).
      //    Use gt (not gte) — treatments happening today are excluded, too late to prep.
      //    Also surface treatments where next_appointment_at (rebooking) falls in the window.
      db
        .from("treatments")
        .select("id, treatment_date, procedure_name, intake_id, next_appointment_at, intakes(id, first_name, email)")
        .eq("nurse_id", user.id)
        .eq("archived", false)
        .is("prep_guide_sent_at", null)
        .or(`and(treatment_date.gt.${today},treatment_date.lte.${in7Days}),and(next_appointment_at.gte.${now.toISOString()},next_appointment_at.lte.${new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()})`)
        .not("intake_id", "is", null),
    ]);

    if (hcRes.error) await logError("assistant/context", hcRes.error.message);
    if (cvRes.error) await logError("assistant/context", cvRes.error.message);
    if (unsentRes.error) await logError("assistant/context", unsentRes.error.message);
    if (scheduledRes.error) await logError("assistant/context", scheduledRes.error.message);
    if (checkinRes.error) await logError("assistant/context", checkinRes.error.message);
    if (prepRes.error) await logError("assistant/context", prepRes.error.message);

    // ── Unhandled alerts ──────────────────────────────────────────────────────
    // Group healing_chats alerts by intake_id so a client with multiple treatments
    // shows as a single card with all flagged messages merged.
    type AlertMsg = { message: string; level: "911" | "nurse"; timestamp: string };
    type AlertRow = {
      id: string; source: "healing" | "chatbot";
      client_name: string | null; client_phone: string | null; client_email: string | null;
      flagged_message: string | null; alert_level: "911" | "nurse" | null;
      alert_messages: AlertMsg[]; timestamp: string;
      // ids of all healing_chat rows merged into this card (for mark-handled)
      healing_ids: string[];
    };

    const healingByIntake = new Map<string, AlertRow>();
    for (const r of (hcRes.data ?? []) as any[]) {
      const intakeId: string = (r.treatments?.intake_id as string | null) ?? r.id;
      const intakeName = r.treatments?.intakes?.first_name ?? null;
      const realName = r.client_name && r.client_name !== "Client" ? r.client_name : intakeName;
      const rowLevel = (r.alert_level ?? null) as "911" | "nurse" | null;
      const rowMsgs = (Array.isArray(r.alert_messages) ? r.alert_messages : []) as AlertMsg[];

      const existing = healingByIntake.get(intakeId);
      if (!existing) {
        healingByIntake.set(intakeId, {
          id: r.id as string,
          source: "healing",
          client_name: realName as string | null,
          client_phone: (r.client_phone ?? null) as string | null,
          client_email: (r.treatments?.intakes?.email ?? null) as string | null,
          flagged_message: (r.flagged_message ?? null) as string | null,
          alert_level: rowLevel,
          alert_messages: rowMsgs,
          timestamp: r.updated_at as string,
          healing_ids: [r.id as string],
        });
      } else {
        // Merge: 911 always wins; keep latest timestamp; combine messages sorted by time
        existing.healing_ids.push(r.id as string);
        if (rowLevel === "911" || existing.alert_level !== "911") {
          if (rowLevel === "911") existing.alert_level = "911";
          else if (!existing.alert_level && rowLevel) existing.alert_level = rowLevel;
        }
        existing.alert_messages = [...existing.alert_messages, ...rowMsgs]
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        if (new Date(r.updated_at).getTime() > new Date(existing.timestamp).getTime()) {
          existing.timestamp = r.updated_at as string;
          existing.flagged_message = (r.flagged_message ?? existing.flagged_message) as string | null;
        }
        if (!existing.client_phone && r.client_phone) existing.client_phone = r.client_phone;
        if (!existing.client_email && r.treatments?.intakes?.email) existing.client_email = r.treatments.intakes.email;
      }
    }

    const unhandledAlerts: AlertRow[] = [
      ...healingByIntake.values(),
      ...(cvRes.data ?? []).map((r: any) => ({
        id: r.id as string,
        source: "chatbot" as const,
        client_name: (r.client_name || null) as string | null,
        client_phone: (r.client_phone ?? null) as string | null,
        client_email: null as string | null,
        flagged_message: (r.flagged_message ?? null) as string | null,
        alert_level: null as "911" | "nurse" | null,
        alert_messages: [] as AlertMsg[],
        timestamp: r.created_at as string,
        healing_ids: [] as string[],
      })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // ── Unsent aftercares ─────────────────────────────────────────────────────
    const unsentAftercares = (unsentRes.data ?? []).map((t: any) => {
      const intake = Array.isArray(t.intakes) ? t.intakes[0] : t.intakes;
      return {
        treatment_id: t.id as string,
        intake_id: t.intake_id as string,
        procedure_id: (t.procedure_id ?? null) as string | null,
        client_name: (intake?.first_name ?? "Client") as string,
        procedure_name: (t.procedure_name ?? "treatment") as string,
        treatment_date: t.treatment_date as string,
      };
    });

    // ── Scheduled aftercares ──────────────────────────────────────────────────
    const scheduledAftercares = (scheduledRes.data ?? []).map((t: any) => {
      const intake = Array.isArray(t.intakes) ? t.intakes[0] : t.intakes;
      return {
        treatment_id: t.id as string,
        intake_id: t.intake_id as string,
        client_name: (intake?.first_name ?? "Client") as string,
        procedure_name: (t.procedure_name ?? "treatment") as string,
        aftercare_send_at: t.aftercare_send_at as string,
      };
    });

    // ── Check-ins overdue/due ─────────────────────────────────────────────────
    const checkinsOverdue = (checkinRes.data ?? []).map((r: any) => {
      const intake = Array.isArray(r.intakes) ? r.intakes[0] : r.intakes;
      return {
        id: r.id as string,
        intake_id: (intake?.id ?? r.intake_id) as string,
        client_name: (intake?.first_name ?? "Client") as string,
        due_date: r.due_date as string,
      };
    });

    // ── Prep reminders ────────────────────────────────────────────────────────
    const prepReminders = (prepRes.data ?? [])
      .filter((t: any) => {
        const intake = Array.isArray(t.intakes) ? t.intakes[0] : t.intakes;
        return !!intake?.email;
      })
      .map((t: any) => {
        const intake = Array.isArray(t.intakes) ? t.intakes[0] : t.intakes;
        return {
          treatment_id: t.id as string,
          intake_id: t.intake_id as string,
          client_name: (intake?.first_name ?? "Client") as string,
          treatment_date: t.treatment_date as string,
          procedure_name: (t.procedure_name ?? "") as string,
        };
      });

    return NextResponse.json({
      unhandledAlerts,
      unsentAftercares,
      scheduledAftercares,
      checkinsOverdue,
      prepReminders,
    });
  } catch (e) {
    await logError("assistant/context", String(e));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
