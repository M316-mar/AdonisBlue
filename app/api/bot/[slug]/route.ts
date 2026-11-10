import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Only fields the public chat page actually needs — never spread the whole row.
// Private fields (notification_email, alert_email, alert_phone, nurse auth email,
// stripe fields, created_at, state, slug) are intentionally excluded.
const PUBLIC_BOT_FIELDS =
  "practice_name, city, instagram, facebook, tiktok, website, other_social, " +
  "bot_name, greeting, tone, booking_link, cancellation_policy, aftercare, numbing_method, " +
  "previous_work_policy, touch_up_policy, same_day_consultation, deposit_info, forward_questions, " +
  "services, logo_image, logo_data_url, logo_url, brand_name_image, bot_name_font, " +
  "bubble_attention_message, photos, frozen, nurse_name";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

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
    .select(PUBLIC_BOT_FIELDS)
    .eq("slug", slug)
    .eq("launched", true)
    .single();

  if (error || !data) {
    const result = await supabase
      .from("bots")
      .select(PUBLIC_BOT_FIELDS)
      .ilike("bot_name", slug.replace(/-/g, " "))
      .eq("launched", true)
      .single();
    data = result.data;
    error = result.error;
  }

  if (error || !data) {
    return NextResponse.json({ error: "Bot not found" }, { status: 404, headers: CORS_HEADERS });
  }

  return NextResponse.json(data, { headers: CORS_HEADERS });
}
