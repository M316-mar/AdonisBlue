import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { blueroomAuth } from "@/lib/blueroomAuth";

export async function POST(request: Request) {
  const auth = await blueroomAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  try {
    const body = await request.json() as { post_id?: string };
    const { post_id } = body;

    if (!post_id) {
      return NextResponse.json({ error: "Something went wrong" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase
      .from("blueroom_post_views")
      .upsert({ post_id, nurse_id: user.id, viewed_at: new Date().toISOString() }, { onConflict: "post_id,nurse_id" });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
