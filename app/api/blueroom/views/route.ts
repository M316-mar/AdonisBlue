import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { post_id?: string; nurse_id?: string };
    const { post_id, nurse_id } = body;

    if (!post_id || !nurse_id) {
      return NextResponse.json({ error: "Something went wrong" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase
      .from("blueroom_post_views")
      .upsert({ post_id, nurse_id, viewed_at: new Date().toISOString() }, { onConflict: "post_id,nurse_id" });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
