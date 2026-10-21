import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { hasUnresolvedPlaceholders } from "@/lib/substitutePlaceholders";

export async function GET(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: procedures } = await supabase
      .from("procedures")
      .select("*")
      .eq("nurse_id", user.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({ procedures: procedures ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

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

    const body = await request.json();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Approval is set server-side only — never trust a client-supplied timestamp or user id.
    const { approved, ...rest } = body;

    // Block approval if the instructions still contain [YOUR PHONE] but the nurse
    // hasn't saved a phone number yet — clients must never receive a placeholder.
    if (approved && typeof rest.aftercare_instructions === "string" && /\[YOUR PHONE\]/i.test(rest.aftercare_instructions)) {
      const { data: bot } = await supabase
        .from("bots")
        .select("alert_phone, phone_public")
        .eq("nurse_id", user.id)
        .maybeSingle();
      const hasPhone = !!(bot?.alert_phone?.trim() || bot?.phone_public?.trim());
      if (!hasPhone) {
        return NextResponse.json(
          { error: "Add your phone number in Settings before approving instructions that include [YOUR PHONE]." },
          { status: 400 }
        );
      }
    }

    let data, error;

    if (rest.id) {
      // Updating an existing row by id (e.g. approving from onboarding step 3 or inline).
      // Always include approval fields so approved_at is set correctly.
      const approvalFields = approved
        ? { approved_at: new Date().toISOString(), approved_by: user.id }
        : {};
      ({ data, error } = await supabase
        .from("procedures")
        .upsert({ ...rest, ...approvalFields, nurse_id: user.id }, { onConflict: "id" })
        .select()
        .single());
    } else {
      // Inserting or upserting a new procedure by (nurse_id, name).
      // Never include approved_at — preserves existing approval if the name already exists.
      const baseFields = approved
        ? { ...rest, approved_at: new Date().toISOString(), approved_by: user.id, nurse_id: user.id }
        : { ...rest, nurse_id: user.id };
      ({ data, error } = await supabase
        .from("procedures")
        .upsert(baseFields, { onConflict: "nurse_id,name" })
        .select()
        .single());
    }

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ procedure: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // If no body (or body has no id), delete ALL procedures for this nurse
    let id: string | undefined;
    try {
      const body = await request.json();
      id = body?.id;
    } catch {
      // no body — treat as delete-all
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (id) {
      await supabase.from("procedures").delete().eq("id", id).eq("nurse_id", user.id);
    } else {
      await supabase.from("procedures").delete().eq("nurse_id", user.id);
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
