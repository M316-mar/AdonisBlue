import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function makeDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Verify the bearer token and return the nurse's user id, or null. */
async function getNurseId(request: Request): Promise<string | null> {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await anonClient.auth.getUser(token);
  return data?.user?.id ?? null;
}

// ── GET /api/incidents — fetch all flagged incidents for the nurse ─────────────
// Query param: ?status=active|accidental (default: active)
export async function GET(request: Request) {
  try {
    const nurseId = await getNurseId(request);
    if (!nurseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") === "accidental" ? "accidental" : "active";

    const db = makeDb();

    // Query both sources in parallel
    const [hcRes, cvRes] = await Promise.all([
      db
        .from("healing_chats")
        .select("id, client_name, client_phone, flagged_message, status, nurse_notes, updated_at, treatment_id")
        .eq("nurse_id", nurseId)
        .eq("flagged", true)
        .eq("status", status)
        .order("updated_at", { ascending: false }),
      db
        .from("conversations")
        .select("id, client_name, client_phone, flagged_message, status, nurse_notes, created_at")
        .eq("nurse_id", nurseId)
        .eq("flagged", true)
        .eq("status", status)
        .order("created_at", { ascending: false }),
    ]);

    // Normalise into a unified shape with a `source` discriminator
    const healingIncidents = (hcRes.data ?? []).map((r) => ({
      id: r.id,
      source: "healing" as const,
      client_name: r.client_name ?? null,
      client_phone: r.client_phone ?? null,
      flagged_message: r.flagged_message ?? null,
      status: r.status as string,
      nurse_notes: r.nurse_notes ?? null,
      timestamp: r.updated_at,
    }));

    const chatIncidents = (cvRes.data ?? []).map((r) => ({
      id: r.id,
      source: "chatbot" as const,
      client_name: r.client_name ?? null,
      client_phone: r.client_phone ?? null,
      flagged_message: r.flagged_message ?? null,
      status: r.status as string,
      nurse_notes: r.nurse_notes ?? null,
      timestamp: r.created_at,
    }));

    // Merge and sort by most recent first
    const all = [...healingIncidents, ...chatIncidents].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({ incidents: all });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// ── PATCH /api/incidents — update status or nurse_notes ──────────────────────
// Body: { id, source: "healing"|"chatbot", field: "status"|"nurse_notes", value: string }
export async function PATCH(request: Request) {
  try {
    const nurseId = await getNurseId(request);
    if (!nurseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, source, field, value } = body;

    if (!id || !UUID_REGEX.test(String(id))) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    if (source !== "healing" && source !== "chatbot") {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }
    if (field !== "status" && field !== "nurse_notes") {
      return NextResponse.json({ error: "Invalid field" }, { status: 400 });
    }
    if (field === "status" && value !== "active" && value !== "accidental" && value !== "resolved") {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    const db = makeDb();
    const table = source === "healing" ? "healing_chats" : "conversations";

    const { error } = await db
      .from(table)
      .update({ [field]: typeof value === "string" ? value.slice(0, 2000) : value })
      .eq("id", id)
      .eq("nurse_id", nurseId); // enforce ownership

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// ── DELETE /api/incidents — permanently delete an incident record ─────────────
// Body: { id, source: "healing"|"chatbot" }
export async function DELETE(request: Request) {
  try {
    const nurseId = await getNurseId(request);
    if (!nurseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { id, source } = body;

    if (!id || !UUID_REGEX.test(String(id))) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    if (source !== "healing" && source !== "chatbot") {
      return NextResponse.json({ error: "Invalid source" }, { status: 400 });
    }

    const db = makeDb();
    const table = source === "healing" ? "healing_chats" : "conversations";

    const { error } = await db
      .from(table)
      .delete()
      .eq("id", id)
      .eq("nurse_id", nurseId); // enforce ownership — can only delete own records

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
