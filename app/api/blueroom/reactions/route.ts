import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { blueroomAuth } from "@/lib/blueroomAuth";

export async function POST(request: Request) {
  const auth = await blueroomAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { user } = auth;

  try {
    const body = await request.json() as { comment_id?: string; reaction?: string };
    const { comment_id, reaction } = body;

    if (!comment_id || !reaction) {
      return NextResponse.json({ error: "Something went wrong" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: existing } = await supabase
      .from("blueroom_comment_reactions")
      .select("id, reaction")
      .eq("comment_id", comment_id)
      .eq("nurse_id", user.id)
      .maybeSingle();

    if (existing) {
      if (existing.reaction === reaction) {
        await supabase.from("blueroom_comment_reactions").delete().eq("id", existing.id);
        return NextResponse.json({ action: "removed", reaction });
      } else {
        await supabase.from("blueroom_comment_reactions").update({ reaction }).eq("id", existing.id);
        return NextResponse.json({ action: "updated", reaction });
      }
    }

    await supabase.from("blueroom_comment_reactions").insert({ comment_id, nurse_id: user.id, reaction });
    return NextResponse.json({ action: "added", reaction });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
