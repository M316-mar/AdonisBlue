import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getAuthToken(request: Request) {
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

    const { data: intakes } = await supabase
      .from("intakes")
      .select("id, first_name, email, phone, service_interested, came_via_bot, created_at, prep_guide_sent, prep_guide_sent_at")
      .eq("nurse_id", user.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ intakes: intakes ?? [] });
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

    const firstName = typeof body.first_name === "string" ? body.first_name.trim().slice(0, 100) : "";
    if (!firstName) return NextResponse.json({ error: "First name is required" }, { status: 400 });

    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (email && !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 20) : null;
    const serviceInterested = typeof body.service_interested === "string"
      ? body.service_interested.trim().slice(0, 200)
      : null;

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: intake, error } = await supabase
      .from("intakes")
      .insert({
        nurse_id: user.id,
        first_name: firstName,
        email: email || null,
        phone: phone || null,
        service_interested: serviceInterested,
        came_via_bot: false,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: "Failed to create intake" }, { status: 500 });
    return NextResponse.json({ intake });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
