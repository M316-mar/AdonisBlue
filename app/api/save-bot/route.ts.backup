import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    console.log("supabaseUrl:", supabaseUrl ? "found" : "MISSING");
    console.log("serviceRoleKey:", serviceRoleKey ? "found" : "MISSING");

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Server configuration error - missing env vars." }, { status: 500 });
    }

    const botData = await request.json();
    console.log("nurse_id received:", botData.nurse_id);

    if (!botData.nurse_id) {
      return NextResponse.json({ error: "Missing nurse_id." }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    const { data, error } = await supabase
      .from("bots")
      .upsert(botData, { onConflict: "nurse_id" })
      .select()
      .single();

    if (error) {
      console.log("Supabase error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.log("Caught error:", String(err));
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

