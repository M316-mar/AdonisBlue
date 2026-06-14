import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }

    // Always derive nurse_id from the verified auth token — never trust the request body.
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const supabaseAuth = createClient(url, anonKey);
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    // Override any client-supplied nurse_id with the authenticated user's ID.
    body.nurse_id = user.id;

    const db = createClient(url, serviceKey);
    const { error } = await db.from("bots").upsert(body, { onConflict: "nurse_id" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
