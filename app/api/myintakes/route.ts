import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

    const { data } = await supabase
      .from("intakes")
      .select("*")
      .eq("nurse_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    const intakes = data ?? [];

    if (intakes.length === 0) return NextResponse.json({ intakes: [] });

    // Fetch all treatments for these intakes to check archive status
    const intakeIds = intakes.map((i) => i.id as string);
    const { data: treatments } = await supabase
      .from("treatments")
      .select("intake_id, archived")
      .in("intake_id", intakeIds);

    // Group treatments by intake_id
    const byIntake = new Map<string, { allArchived: boolean }>();
    for (const t of treatments ?? []) {
      const id = t.intake_id as string;
      const existing = byIntake.get(id);
      if (!existing) {
        byIntake.set(id, { allArchived: t.archived === true });
      } else {
        byIntake.set(id, { allArchived: existing.allArchived && t.archived === true });
      }
    }

    // Keep intakes that have no treatments (new clients) or have at least one non-archived treatment
    const active = intakes.filter((i) => {
      const entry = byIntake.get(i.id as string);
      if (!entry) return true; // no treatments — still active
      return !entry.allArchived;
    });

    return NextResponse.json({ intakes: active });
  } catch (e) {
    return NextResponse.json({ intakes: [] });
  }
}
