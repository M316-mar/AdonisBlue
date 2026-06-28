import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import Stripe from "stripe";

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

    const { data: bot } = await db
      .from("bots")
      .select("stripe_customer_id")
      .eq("nurse_id", user.id)
      .single();

    if (!bot?.stripe_customer_id) {
      return NextResponse.json({ error: "No billing account found." }, { status: 404 });
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return NextResponse.json({ error: "Stripe not configured." }, { status: 500 });

    const stripe = new Stripe(stripeKey, { apiVersion: "2026-05-27.dahlia" });

    const session = await stripe.billingPortal.sessions.create({
      customer: bot.stripe_customer_id,
      return_url: "https://www.adonisblue.io/dashboard",
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[billing-portal] unexpected error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
