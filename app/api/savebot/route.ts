import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    
    console.log("URL:", url ? "found" : "MISSING");
    console.log("KEY:", key ? "found" : "MISSING");
    
    const body = await request.json();
    console.log("nurse_id:", body.nurse_id);
    console.log("bot_name:", body.bot_name);
    
    const db = createClient(url, key);
    const { error } = await db.from("bots").upsert(body, { onConflict: "nurse_id" });
    
    console.log("DB error:", error?.message ?? "none");
    
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch(e) {
    console.log("CAUGHT:", String(e));
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
