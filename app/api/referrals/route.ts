import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: bot } = await supabase
      .from("bots")
      .select("slug, practice_name")
      .eq("nurse_id", user.id)
      .single();

    const { data: referrals } = await supabase
      .from("referrals")
      .select("*")
      .eq("referrer_nurse_id", user.id)
      .order("created_at", { ascending: false });

    const confirmedCount = (referrals ?? []).filter(r => r.status === "confirmed").length;
    const freeMonths = Math.floor(confirmedCount / 1);

    return NextResponse.json({
      referral_link: `https://adonisblue.io/ref/${bot?.slug || user.id}`,
      referrals: referrals ?? [],
      confirmed_count: confirmedCount,
      free_months_earned: freeMonths,
      slug: bot?.slug,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
