import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string };
    const email = (body.email ?? "").trim().toLowerCase();

    // Basic email format validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await db
      .from("newsletter_subscribers")
      .upsert({ email }, { onConflict: "email" });

    if (error) {
      console.error("[newsletter-signup] supabase error:", error.message, error.code, error.details);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Add to Beehiiv
    const beehiivKey = process.env.BEEHIIV_API_KEY;
    const beehiivPubId = process.env.BEEHIIV_PUBLICATION_ID;

    if (beehiivKey && beehiivPubId) {
      try {
        await fetch(`https://api.beehiiv.com/v2/publications/${beehiivPubId}/subscriptions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${beehiivKey}`,
          },
          body: JSON.stringify({
            email,
            reactivate_existing: false,
            send_welcome_email: true,
          }),
        });
      } catch (e) {
        console.error("[newsletter-signup] beehiiv error:", e);
        // Non-fatal — Supabase save already succeeded
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[newsletter-signup] unexpected error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
