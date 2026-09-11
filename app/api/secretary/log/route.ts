import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

async function getUser(request: Request) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return null;
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user } } = await anon.auth.getUser(token);
  return user ?? null;
}

export async function POST(request: Request) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const action_type = typeof body.action_type === "string" ? body.action_type : "unknown";
    const target_intake_id = typeof body.target_intake_id === "string" ? body.target_intake_id : null;
    const target_treatment_id = typeof body.target_treatment_id === "string" ? body.target_treatment_id : null;

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await db.from("secretary_action_log").insert({
      nurse_id: user.id,
      action_type,
      target_intake_id,
      target_treatment_id,
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
