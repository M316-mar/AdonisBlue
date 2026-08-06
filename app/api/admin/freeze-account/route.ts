// POST  — freeze / unfreeze a nurse account (sets bots.frozen)
// DELETE — hard-delete a nurse and all related data (irreversible)

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

async function getAuthedUser(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;

  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await supabaseAuth.auth.getUser(token);
  return user ?? null;
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function isAdmin(userId: string) {
  const { data } = await serviceClient()
    .from("admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data);
}

// ── DELETE: hard-delete nurse + all related data ───────────────────────────
export async function DELETE(request: Request) {
  try {
    const { nurse_id } = await request.json() as { nurse_id?: string };
    if (!nurse_id) return NextResponse.json({ error: "nurse_id is required" }, { status: 400 });

    const db = serviceClient();
    const errors: string[] = [];

    // Delete children first to avoid FK constraint violations
    const tables = [
      "conversations",
      "intakes",
      "treatments",
      "offers",
      "procedures",
      "bots",
      "nurses",
    ] as const;

    for (const table of tables) {
      const { error } = await db.from(table).delete().eq("nurse_id", nurse_id);
      if (error) errors.push(`${table}: ${error.message}`);
    }

    // Remove the Supabase auth account last (so the nurse can't log back in
    // while DB cleanup is still running, and so we have nurse_id available above)
    const { error: authError } = await db.auth.admin.deleteUser(nurse_id);
    if (authError) errors.push(`auth: ${authError.message}`);

    if (errors.length > 0) {
      return NextResponse.json({ error: "Partial failure", details: errors }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// ── POST: freeze / unfreeze ────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { nurse_id, frozen } = await request.json();
    if (!nurse_id || typeof frozen !== "boolean") {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from("bots")
      .update({ frozen })
      .eq("nurse_id", nurse_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
