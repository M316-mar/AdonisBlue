import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import Stripe from "stripe";

const PRICE_IDS: Record<string, Record<string, string>> = {
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "",
    annual:  process.env.STRIPE_PRICE_STARTER_ANNUAL  ?? "",
  },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
    annual:  process.env.STRIPE_PRICE_PRO_ANNUAL  ?? "",
  },
};

export async function POST(request: Request) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return NextResponse.json({ error: "Stripe not configured." }, { status: 500 });
    }

    // ── Auth ──────────────────────────────────────────────────────────────
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    // ── Resolve price ID ──────────────────────────────────────────────────
    const body = await request.json() as { plan?: string; billing?: string };
    const plan    = (body.plan    ?? "starter").toLowerCase();
    const billing = (body.billing ?? "monthly").toLowerCase();

    const priceId = PRICE_IDS[plan]?.[billing];
    if (!priceId) {
      return NextResponse.json({ error: `Unknown plan/billing combination: ${plan}/${billing}` }, { status: 400 });
    }

    // ── Create Stripe checkout session ────────────────────────────────────
    const stripe = new Stripe(stripeKey, { apiVersion: "2026-05-27.dahlia" });

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.id,
      success_url: "https://www.adonisblue.io/dashboard?upgraded=true",
      cancel_url:  "https://www.adonisblue.io/dashboard",
      metadata: {
        nurse_id: user.id,
        plan,
        billing,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
