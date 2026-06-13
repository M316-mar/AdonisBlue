import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Digits, spaces, +, -, (, ) — international-friendly
const PHONE_REGEX = /^[0-9\s\+\-\(\)]{7,20}$/;

function getAuthToken(request: Request): string | null {
  return request.headers.get("authorization")?.replace("Bearer ", "").trim() || null;
}

async function getAuthUser(token: string) {
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await supabaseAuth.auth.getUser(token);
  return user;
}

export async function GET(request: Request) {
  try {
    const token = getAuthToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getAuthUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: bot } = await supabase
      .from("bots")
      .select("notification_email, alert_phone")
      .eq("nurse_id", user.id)
      .single();

    return NextResponse.json({
      alert_email: bot?.notification_email ?? "",
      alert_phone: bot?.alert_phone ?? "",
    });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const token = getAuthToken(request);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getAuthUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();

    // Validate and sanitise email
    const rawEmail = typeof body.alert_email === "string" ? body.alert_email.trim() : "";
    if (rawEmail && !EMAIL_REGEX.test(rawEmail)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }
    if (rawEmail.length > 254) {
      return NextResponse.json({ error: "Email address too long" }, { status: 400 });
    }

    // Validate and sanitise phone
    const rawPhone = typeof body.alert_phone === "string" ? body.alert_phone.trim() : "";
    if (rawPhone && !PHONE_REGEX.test(rawPhone)) {
      return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase
      .from("bots")
      .upsert(
        {
          nurse_id: user.id,
          notification_email: rawEmail || null,
          alert_phone: rawPhone || null,
        },
        { onConflict: "nurse_id" }
      );

    if (error) return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
