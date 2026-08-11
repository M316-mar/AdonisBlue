import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const secret = request.headers.get("x-admin-secret");
    if (secret !== process.env.ADMIN_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { nurse_id } = await request.json() as { nurse_id?: string };
    if (!nurse_id) return NextResponse.json({ error: "nurse_id is required" }, { status: 400 });

    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Delete in dependency order (children first, parents last)
    await db.from("healing_chats").delete().eq("nurse_id", nurse_id);
    await db.from("blueroom_comment_reactions").delete().eq("nurse_id", nurse_id);

    const { data: ownPosts } = await db.from("blueroom_posts").select("id").eq("nurse_id", nurse_id);
    const postIds = (ownPosts ?? []).map((p) => p.id as string);
    if (postIds.length > 0) {
      await db.from("blueroom_comments").delete().in("post_id", postIds);
      await db.from("blueroom_post_reactions").delete().in("post_id", postIds);
      await db.from("blueroom_post_views").delete().in("post_id", postIds);
    }
    await db.from("blueroom_comments").delete().eq("nurse_id", nurse_id);
    await db.from("blueroom_post_reactions").delete().eq("nurse_id", nurse_id);
    await db.from("blueroom_post_views").delete().eq("nurse_id", nurse_id);
    await db.from("blueroom_notifications").delete().eq("nurse_id", nurse_id);
    await db.from("blueroom_posts").delete().eq("nurse_id", nurse_id);
    await db.from("blueroom_posts").delete().eq("author_id", nurse_id);
    await db.from("loyalty_points").delete().eq("nurse_id", nurse_id);
    await db.from("loyalty_programs").delete().eq("nurse_id", nurse_id);
    await db.from("referrals").delete().eq("referrer_nurse_id", nurse_id);
    await db.from("referrals").delete().eq("nurse_id", nurse_id);
    await db.from("emergency_keywords").delete().eq("nurse_id", nurse_id);
    await db.from("reviews").delete().eq("nurse_id", nurse_id);
    await db.from("treatments").delete().eq("nurse_id", nurse_id);
    await db.from("procedures").delete().eq("nurse_id", nurse_id);
    await db.from("intakes").delete().eq("nurse_id", nurse_id);
    await db.from("conversations").delete().eq("nurse_id", nurse_id);
    await db.from("feedback").delete().eq("nurse_id", nurse_id);
    await db.from("newsletters").delete().eq("nurse_id", nurse_id);
    await db.from("admins").delete().eq("user_id", nurse_id);
    await db.from("bots").delete().eq("nurse_id", nurse_id);

    const { error: authDeleteError } = await db.auth.admin.deleteUser(nurse_id);
    if (authDeleteError) {
      console.error("[delete-nurse] auth.admin.deleteUser failed:", authDeleteError.message);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[delete-nurse] unexpected error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
