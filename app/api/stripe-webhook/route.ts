import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import Stripe from "stripe";

// Map Stripe price IDs → plan names
const PRICE_TO_PLAN: Record<string, string> = {
  [process.env.STRIPE_PRICE_STARTER_MONTHLY ?? "___"]: "starter",
  [process.env.STRIPE_PRICE_STARTER_ANNUAL  ?? "___"]: "starter",
  [process.env.STRIPE_PRICE_PRO_MONTHLY     ?? "___"]: "pro",
  [process.env.STRIPE_PRICE_PRO_ANNUAL      ?? "___"]: "pro",
};

// Next.js App Router — must read raw body for Stripe signature verification
export const runtime = "nodejs";

export async function POST(request: Request) {
  const stripeKey     = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: "Stripe not configured." }, { status: 500 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2026-05-27.dahlia" });

  // ── Verify signature ───────────────────────────────────────────────────
  const rawBody = await request.text();
  const sig     = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Webhook signature failed: ${msg}` }, { status: 400 });
  }

  // ── Handle events ──────────────────────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const nurseId       = session.client_reference_id ?? session.metadata?.nurse_id;
    const customerId    = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id ?? null;

    // Determine plan from the line items' price ID via metadata fallback
    const planFromMeta = session.metadata?.plan ?? "starter";

    // Try to get the exact price from the subscription's line items
    let planName = planFromMeta;
    if (subscriptionId) {
      try {
        const sub = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ["items.data.price"],
        });
        const priceId = sub.items.data[0]?.price?.id;
        if (priceId && PRICE_TO_PLAN[priceId]) {
          planName = PRICE_TO_PLAN[priceId];
        }
      } catch {
        // Non-fatal — fall back to metadata plan
      }
    }

    if (nurseId) {
      const db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await db.from("bots").upsert({
        nurse_id:               nurseId,
        plan:                   planName,
        subscription_status:    "active",
        stripe_customer_id:     customerId,
        stripe_subscription_id: subscriptionId,
      }, { onConflict: "nurse_id" });
    }
  }

  if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.paused") {
    const subscription = event.data.object as Stripe.Subscription;
    const customerId   = typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await db.from("bots").update({
      subscription_status: event.type === "customer.subscription.deleted" ? "canceled" : "paused",
    }).eq("stripe_customer_id", customerId);
  }

  return NextResponse.json({ received: true });
}
