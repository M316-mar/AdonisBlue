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
  const botFields =
    "id, nurse_id, practice_name, city, state, instagram, facebook, tiktok, website, other_social, notification_email, bot_name, slug, greeting, tone, chat_theme, primary_color, booking_link, cancellation_policy, aftercare, numbing_method, previous_work_policy, touch_up_policy, same_day_consultation, deposit_info, forward_questions, services, logo_image, logo_data_url, brand_name_image, bot_name_font, bubble_attention_message, photos, launched, frozen, created_at";

  let { data, error } = await supabase
    .from("bots")
    .select(botFields)
    .eq("slug", slug)
    .eq("launched", true)
    .single();

  if (error || !data) {
    const result = await supabase
      .from("bots")
      .select(botFields)
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
