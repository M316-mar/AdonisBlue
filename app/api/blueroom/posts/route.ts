import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const WELCOME_POST = {
  title: "Welcome to The Blue Room 💙",
  content: `Welcome to The Blue Room — your private community built just for nurse injectors like you! 💙

This is YOUR space to:
✨ Stay on top of the latest aesthetic trends
💉 Learn new techniques from your peers
📈 Get business tips to grow your practice
🔔 Be first to know about industry news

We built this because nurses deserve a real community — not a random Facebook group where anyone can see your business. This is ours.

Introduce yourself below! Tell us your name, where you practice, and your favorite treatment to do. We can't wait to meet you 💕

— The AdonisBlue Team`,
  category: "general",
  emoji: "💙",
};

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let { data: posts } = await supabase
      .from("blueroom_posts")
      .select("*, blueroom_comments(count)")
      .order("created_at", { ascending: false });

    if (!posts?.length) {
      const { data: seeded } = await supabase
        .from("blueroom_posts")
        .insert(WELCOME_POST)
        .select("*, blueroom_comments(count)")
        .single();
      posts = seeded ? [seeded] : [];
    }

    return NextResponse.json({ posts: posts ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from("blueroom_posts")
      .insert({
        title: body.title,
        content: body.content,
        category: body.category || "general",
        emoji: body.emoji || "💙",
        author_id: body.author_id ?? null,
        author_name: body.author_name ?? null,
        media_url: body.media_url ?? null,
        media_type: body.media_type ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ post: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
