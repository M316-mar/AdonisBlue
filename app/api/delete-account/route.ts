import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const nurse_id = user.id;

    // Delete reviews first (references intakes)
    const { data: intakes } = await supabase
      .from("intakes")
      .select("id")
      .eq("nurse_id", nurse_id);

    if (intakes && intakes.length > 0) {
      const intakeIds = intakes.map(i => i.id);
      await supabase.from("reviews").delete().in("intake_id", intakeIds);
    }

    // Delete intakes
    await supabase.from("intakes").delete().eq("nurse_id", nurse_id);

    // Delete bots
    await supabase.from("bots").delete().eq("nurse_id", nurse_id);

    // Delete auth user
    await supabase.auth.admin.deleteUser(nurse_id);

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}