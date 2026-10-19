import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function blueroomAuth(
  request: Request
): Promise<{ user: { id: string; email?: string; user_metadata?: Record<string, unknown> } } | NextResponse> {
  const token = request.headers.get("authorization")?.replace("Bearer ", "").trim();
  if (!token) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  return { user };
}
