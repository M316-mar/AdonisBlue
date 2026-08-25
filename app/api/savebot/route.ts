import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * DATA PRESERVATION RULE — This route NEVER overwrites existing data with
 * empty/null values. Each field is only written to the DB when the client
 * supplies a real value. This prevents partial saves (e.g. from skipped
 * onboarding steps) from blanking out fields the nurse filled in earlier.
 *
 * Exceptions:
 *   - logo_url: null is intentional (nurse removed logo) — always written
 *     when the key is present in the request body.
 *   - services: an empty array is intentional — written when key is present.
 *   - launched: boolean — always written when the key is present.
 *   - notification_email, numbing_method, cancellation_policy, booking_link,
 *     instagram, tiktok, facebook, website: null clears the field intentionally
 *     but ONLY when the key is explicitly present in the body.
 */

export async function POST(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

    if (!url || !anonKey || !serviceKey) {
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }

    // Always derive nurse_id from the verified auth token — never trust the body.
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const supabaseAuth = createClient(url, anonKey);
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;

    // ── Build selective update — only include fields with real values ─────
    const update: Record<string, unknown> = {
      nurse_id: user.id, // always authoritative from auth token
    };

    // String fields — only write when non-empty after trim
    const stringFields: string[] = [
      "practice_name", "city", "state", "bot_name", "slug",
      "greeting", "tone", "brand_color",
      "booking_link", "cancellation_policy", "numbing_method",
      "previous_work_policy", "touch_up_policy", "same_day_consultation",
      "deposit_info", "forward_questions", "aftercare",
      "bot_name_font", "bubble_attention_message", "pre_appointment_instructions",
    ];
    for (const field of stringFields) {
      if (field in body) {
        const val = body[field];
        if (typeof val === "string" && val.trim()) {
          update[field] = val.trim();
        }
        // If val is null or empty string, we skip it — existing value is preserved
      }
    }

    // Nullable string fields — null explicitly clears the field (intentional)
    // Only write when key is present in body
    const nullableStringFields: string[] = [
      "instagram", "tiktok", "facebook", "website",
      "notification_email", "other_social",
      "logo_image", "logo_data_url", "brand_name_image",
    ];
    for (const field of nullableStringFields) {
      if (field in body) {
        const val = body[field];
        if (typeof val === "string" && val.trim()) {
          update[field] = val.trim();
        } else if (val === null) {
          update[field] = null;
        }
        // empty string → skip (don't clear)
      }
    }

    // logo_url — null is intentional (nurse removed their logo)
    if ("logo_url" in body) {
      const val = body["logo_url"];
      update["logo_url"] = (typeof val === "string" && val.trim()) ? val.trim() : null;
    }

    // services array — written when present (empty array intentionally clears)
    if ("services" in body && Array.isArray(body["services"])) {
      update["services"] = body["services"];
    }

    // photos array — written when present
    if ("photos" in body && Array.isArray(body["photos"])) {
      update["photos"] = body["photos"];
    }

    // Boolean fields — only written when the key is present and value is boolean
    for (const field of ["launched", "frozen"] as const) {
      if (field in body && typeof body[field] === "boolean") {
        update[field] = body[field];
      }
    }

    const db = createClient(url, serviceKey);

    // Check previous launched state before upsert if we're setting launched=true
    let wasAlreadyLaunched = true;
    if (update["launched"] === true) {
      const { data: existing } = await db
        .from("bots")
        .select("launched, practice_name, city, state, plan")
        .eq("nurse_id", user.id)
        .maybeSingle();
      wasAlreadyLaunched = existing?.launched === true;

      // Send launch notification only on first launch
      if (!wasAlreadyLaunched) {
        const practiceName = typeof body["practice_name"] === "string" && body["practice_name"].trim()
          ? body["practice_name"].trim()
          : existing?.practice_name ?? "";
        const city = typeof body["city"] === "string" && body["city"].trim()
          ? body["city"].trim()
          : existing?.city ?? "";
        const state = typeof body["state"] === "string" && body["state"].trim()
          ? body["state"].trim()
          : existing?.state ?? "";
        const plan = typeof body["plan"] === "string" && body["plan"].trim()
          ? body["plan"].trim()
          : existing?.plan ?? "trial";

        const nurseEmail = user.email ?? "Unknown";
        const safePractice = escapeHtml(practiceName || "Unknown");
        const safeEmail = escapeHtml(nurseEmail);
        const safeCity = escapeHtml(city || "—");
        const safeState = escapeHtml(state || "—");
        const safePlan = escapeHtml(plan);
        const safeNurseName = escapeHtml(user.user_metadata?.full_name ?? user.email ?? "Unknown");
        const now = new Date().toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "full", timeStyle: "short" });

        resend.emails.send({
          from: "AdonisBlue <hi@adonisblue.io>",
          to: "hi@adonisblue.io",
          subject: `🎉 New nurse joined AdonisBlue: ${safePractice}`,
          html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #1a2744;">🎉 A new nurse just launched their assistant!</h2>
              <table style="border-collapse: collapse; width: 100%;">
                <tr><td style="padding: 8px 0; color: #666; width: 140px;">Name</td><td style="padding: 8px 0;"><strong>${safeNurseName}</strong></td></tr>
                <tr><td style="padding: 8px 0; color: #666;">Email</td><td style="padding: 8px 0;">${safeEmail}</td></tr>
                <tr><td style="padding: 8px 0; color: #666;">Practice</td><td style="padding: 8px 0;">${safePractice}</td></tr>
                <tr><td style="padding: 8px 0; color: #666;">Location</td><td style="padding: 8px 0;">${safeCity}, ${safeState}</td></tr>
                <tr><td style="padding: 8px 0; color: #666;">Plan</td><td style="padding: 8px 0;">${safePlan}</td></tr>
                <tr><td style="padding: 8px 0; color: #666;">Date/Time</td><td style="padding: 8px 0;">${escapeHtml(now)}</td></tr>
              </table>
              <p style="margin-top: 24px;">
                <a href="https://www.adonisblue.io/admin" style="background:#1a2744;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;">View in Admin →</a>
              </p>
            </div>
          `,
        }).catch(() => {}); // fire-and-forget
      }
    }

    const { error } = await db.from("bots").upsert(update, { onConflict: "nurse_id" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
