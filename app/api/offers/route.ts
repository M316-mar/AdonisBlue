import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

async function getAuthenticatedUser(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return null;
  const auth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await auth.auth.getUser(token);
  return user ?? null;
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET — fetch all offers for this nurse, with computed active status
export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db = serviceClient();
    const now = new Date().toISOString();

    const { data, error } = await db
      .from("offers")
      .select("*")
      .eq("nurse_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Auto-set active = false for expired or not-yet-started offers.
    // Ongoing offers have no expiry — they stay active as long as active=true.
    const offers = (data ?? []).map((o: Record<string, unknown>) => {
      const ongoing = o.ongoing === true;
      const expired = !ongoing && o.expires_at && (o.expires_at as string) < now;
      const notStarted = !ongoing && o.starts_at && (o.starts_at as string) > now;
      const active = o.active === true && !expired && !notStarted;
      return { ...o, active };
    });

    return NextResponse.json({ offers });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST — create a new offer
export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json() as Record<string, unknown>;
    const db = serviceClient();

    const { data, error } = await db
      .from("offers")
      .insert({
        nurse_id: user.id,
        title: body.title,
        description: body.description ?? null,
        discount_type: body.discount_type ?? "percentage",
        discount_value: body.discount_value ?? null,
        service_name: body.service_name ?? null,
        ongoing: body.ongoing ?? false,
        starts_at: body.ongoing ? null : (body.starts_at ?? null),
        expires_at: body.ongoing ? null : (body.expires_at ?? null),
        active: body.active ?? true,
      })
      .select()
      .single();

    if (error) return NextResponse.json({
      error: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    }, { status: 500 });
    return NextResponse.json({ offer: data });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH — toggle active or update fields by id
export async function PATCH(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json() as { id?: string; active?: boolean };
    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const db = serviceClient();
    const { error } = await db
      .from("offers")
      .update({ active: body.active })
      .eq("id", body.id)
      .eq("nurse_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE — delete offer by id
export async function DELETE(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json() as { id?: string };
    if (!body.id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const db = serviceClient();
    const { error } = await db
      .from("offers")
      .delete()
      .eq("id", body.id)
      .eq("nurse_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
