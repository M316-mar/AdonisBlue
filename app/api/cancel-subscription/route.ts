import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch the bot row to get the Stripe subscription ID
    const { data: bot } = await db
      .from("bots")
      .select("stripe_subscription_id")
      .eq("nurse_id", user.id)
      .single();

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (stripeKey && bot?.stripe_subscription_id) {
      // Cancel the Stripe subscription at period end so the nurse keeps access until billing cycle ends
      await fetch(`https://api.stripe.com/v1/subscriptions/${bot.stripe_subscription_id}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "cancel_at_period_end=true",
      });
    }

    // Mark subscription as canceled in the bots table — never touch auth
    await db
      .from("bots")
      .update({ subscription_status: "canceled", plan: "free" })
      .eq("nurse_id", user.id);

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[cancel-subscription] unexpected error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
