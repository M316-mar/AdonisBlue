import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return NextResponse.json({ error: "Supabase environment variables are not configured." }, { status: 500 });
  }

  const authorization = request.headers.get("authorization");
  if (!authorization) {
    return NextResponse.json({ error: "Missing Authorization header." }, { status: 401 });
  }

  let botData: Record<string, unknown>;
  try {
    botData = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!botData.nurse_id) {
    return NextResponse.json({ error: "Missing nurse_id." }, { status: 400 });
  }
  delete botData.photos;
  delete botData.logo_image;
  delete botData.logo_data_url;
  delete botData.brand_name_image;
  delete botData.brand_name_data_url;

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

  const { data, error } = await supabase.from("bots").upsert(botData, { onConflict: "nurse_id" }).select().single();

  if (error) {
    return NextResponse.json({ error: error.message, details: error }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
