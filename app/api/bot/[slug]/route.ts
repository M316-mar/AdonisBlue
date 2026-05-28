import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Try slug first, then fall back to bot_name
  let { data, error } = await supabase
    .from("bots")
    .select("*")
    .eq("slug", slug)
    .eq("launched", true)
    .single();

  if (error || !data) {
    const result = await supabase
      .from("bots")
      .select("*")
      .ilike("bot_name", slug.replace(/-/g, " "))
      .eq("launched", true)
      .single();
    data = result.data;
    error = result.error;
  }

  if (error || !data) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404 });
  }

  // Get nurse email from auth
  const { data: nurseData } = await supabase.auth.admin.getUserById(data.nurse_id);
  const nurse_email = nurseData?.user?.email ?? null;

  return NextResponse.json({ ...data, nurse_email });
}
