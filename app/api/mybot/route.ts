import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");
    
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("bots")
      .select(
        "id, nurse_id, practice_name, city, state, instagram, facebook, tiktok, website, other_social, notification_email, bot_name, slug, greeting, tone, chat_theme, primary_color, booking_link, cancellation_policy, aftercare, numbing_method, previous_work_policy, touch_up_policy, same_day_consultation, deposit_info, forward_questions, services, logo_image, logo_data_url, brand_name_image, bot_name_font, bubble_attention_message, photos, launched, frozen, created_at, plan, trial_ends_at, subscription_status"
      )
      .eq("nurse_id", user.id)
      .single();

    if (error) {
      return NextResponse.json({ bot: null });
    }

    return NextResponse.json({ bot: data });
  } catch (e) {
    return NextResponse.json({ bot: null });
  }
}
