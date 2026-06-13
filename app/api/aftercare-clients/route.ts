import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function getAuthToken(request: Request): string | null {
  return request.headers.get("authorization")?.replace("Bearer ", "").trim() || null;
}

async function getAuthUser(token: string) {
  const supabaseAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser(token);
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

    // Fetch all intakes for this nurse
    const { data: intakes, error } = await supabase
      .from("intakes")
      .select(
        "id, first_name, email, phone, service_interested, created_at, came_via_bot"
      )
      .eq("nurse_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }

    const url = new URL(request.url);
    const clients = (intakes ?? []).map((intake) => ({
      ...intake,
      came_via_bot: intake.came_via_bot ?? false,
    }));

    // Filter by procedure if query param provided
    const procedureFilter = url.searchParams.get("procedure");
    const filtered = procedureFilter
      ? clients.filter(c =>
          (c.service_interested ?? "").toLowerCase().includes(procedureFilter.toLowerCase())
        )
      : clients;

    return NextResponse.json({ clients: filtered });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
