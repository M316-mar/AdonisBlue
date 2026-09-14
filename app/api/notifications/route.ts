import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function makeDb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

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

export async function GET(request: Request) {
  try {
    const nurseId = await getNurseId(request);
    if (!nurseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = makeDb();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [hcRes, cvRes] = await Promise.all([
      db
        .from("healing_chats")
        .select("id, client_name, flagged_message, updated_at")
        .eq("nurse_id", nurseId)
        .eq("flagged", true)
        .eq("status", "active")
        .gte("updated_at", sevenDaysAgo)
        .order("updated_at", { ascending: false }),
      db
        .from("conversations")
        .select("id, client_name, flagged_message, created_at")
        .eq("nurse_id", nurseId)
        .eq("flagged", true)
        .eq("status", "active")
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false }),
    ]);

    const all = [
      ...(hcRes.data ?? []).map((r) => ({
        id: r.id,
        client_name: r.client_name ?? "Unknown client",
        flagged_message: r.flagged_message ?? "",
        created_at: r.updated_at,
      })),
      ...(cvRes.data ?? []).map((r) => ({
        id: r.id,
        client_name: r.client_name ?? "Unknown client",
        flagged_message: r.flagged_message ?? "",
        created_at: r.created_at,
      })),
    ]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);

    return NextResponse.json({ notifications: all });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
