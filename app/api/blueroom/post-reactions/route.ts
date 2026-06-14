import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const VALID_REACTIONS = ["👍", "❤️", "🔥", "💉"] as const;
type Reaction = (typeof VALID_REACTIONS)[number];

interface ReactionRow {
  reaction: string;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const post_id = searchParams.get("post_id");
    const nurse_id = searchParams.get("nurse_id");

    if (!post_id || !nurse_id) {
      return NextResponse.json({ error: "Something went wrong" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: rows } = await supabase
      .from("blueroom_post_reactions")
      .select("reaction")
      .eq("post_id", post_id);

    const reactions: Record<string, number> = {};
    for (const emoji of VALID_REACTIONS) {
      reactions[emoji] = 0;
    }
    for (const row of (rows ?? []) as ReactionRow[]) {
      if (row.reaction in reactions) {
        reactions[row.reaction]++;
      }
    }

    const { data: myRow } = await supabase
      .from("blueroom_post_reactions")
      .select("reaction")
      .eq("post_id", post_id)
      .eq("nurse_id", nurse_id)
      .maybeSingle();

    const my_reaction: Reaction | null = myRow
      ? (myRow.reaction as Reaction)
      : null;

    return NextResponse.json({ reactions, my_reaction });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { post_id?: string; nurse_id?: string; reaction?: string };
    const { post_id, nurse_id, reaction } = body;

    if (!post_id || !nurse_id || !reaction) {
      return NextResponse.json({ error: "Something went wrong" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: existing } = await supabase
      .from("blueroom_post_reactions")
      .select("id, reaction")
      .eq("post_id", post_id)
      .eq("nurse_id", nurse_id)
      .maybeSingle();

    if (existing) {
      if (existing.reaction === reaction) {
        // Toggle off — remove
        await supabase
          .from("blueroom_post_reactions")
          .delete()
          .eq("id", existing.id);
        return NextResponse.json({ action: "removed", reaction });
      } else {
        // Switch reaction
        await supabase
          .from("blueroom_post_reactions")
          .update({ reaction })
          .eq("id", existing.id);
        return NextResponse.json({ action: "updated", reaction });
      }
    } else {
      await supabase.from("blueroom_post_reactions").insert({ post_id, nurse_id, reaction });
      return NextResponse.json({ action: "added", reaction });
    }
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
