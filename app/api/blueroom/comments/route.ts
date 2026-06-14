import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const post_id = searchParams.get("post_id");

    if (!post_id) return NextResponse.json({ error: "post_id required" }, { status: 400 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: comments } = await supabase
      .from("blueroom_comments")
      .select("*")
      .eq("post_id", post_id)
      .order("created_at", { ascending: true });

    return NextResponse.json({ comments: comments ?? [] });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

interface PostRow {
  author_id: string | null;
  title: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { post_id?: string; nurse_id?: string; nurse_name?: string; message?: string; media_url?: string | null };
    const { post_id, nurse_id, nurse_name, message, media_url } = body;

    if (!post_id || (!message?.trim() && !media_url)) {
      return NextResponse.json({ error: "Something went wrong" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("blueroom_comments")
      .insert({
        post_id,
        nurse_id,
        nurse_name,
        message: message ?? "",
        media_url: media_url ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: "Something went wrong" }, { status: 500 });

    // Insert notification for post author (skip if self-comment)
    try {
      const { data: post } = await supabase
        .from("blueroom_posts")
        .select("author_id, title")
        .eq("id", post_id)
        .single();
      const postRow = post as PostRow | null;
      if (postRow?.author_id && postRow.author_id !== nurse_id) {
        await supabase.from("blueroom_notifications").insert({
          nurse_id: postRow.author_id,
          type: "comment",
          post_id,
          post_title: postRow.title,
          actor_name: nurse_name ?? "Someone",
        });
      }
    } catch {
      // Notification failure should not block response
    }

    return NextResponse.json({ comment: data });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { comment_id, nurse_id } = await request.json();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await supabase.from("blueroom_comments").delete().eq("id", comment_id).eq("nurse_id", nurse_id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
