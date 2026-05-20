import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    if (!url || !key) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }

    const body = await request.json();

    if (!body.nurse_id) {
      return NextResponse.json({ error: "Missing nurse_id." }, { status: 400 });
    }

    const db = createClient(url, key);
    const { error } = await db.from("bots").upsert(body, { onConflict: "nurse_id" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
