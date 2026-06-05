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
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { post_id, nurse_id, nurse_name, message, media_url } = body;

    if (!post_id || (!message?.trim() && !media_url)) {
      return NextResponse.json({ error: "post_id and message or media required" }, { status: 400 });
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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ comment: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
