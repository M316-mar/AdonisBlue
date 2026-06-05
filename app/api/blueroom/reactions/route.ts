import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { comment_id, nurse_id, reaction } = await request.json();

    if (!comment_id || !nurse_id || !reaction) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if reaction already exists
    const { data: existing } = await supabase
      .from("blueroom_comment_reactions")
      .select("*")
      .eq("comment_id", comment_id)
      .eq("nurse_id", nurse_id)
      .single();

    if (existing) {
      if (existing.reaction === reaction) {
        // Same reaction — remove it (toggle off)
        await supabase
          .from("blueroom_comment_reactions")
          .delete()
          .eq("id", existing.id);
        return NextResponse.json({ action: "removed", reaction });
      } else {
        // Different reaction — update it
        await supabase
          .from("blueroom_comment_reactions")
          .update({ reaction })
          .eq("id", existing.id);
        return NextResponse.json({ action: "updated", reaction });
      }
    }

    // New reaction
    await supabase
      .from("blueroom_comment_reactions")
      .insert({ comment_id, nurse_id, reaction });

    return NextResponse.json({ action: "added", reaction });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
