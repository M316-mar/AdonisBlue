import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const nurse_id = user.id;

    // ── 1. Collect IDs of child aggregates ────────────────────────────────────
    const [intakesRes, conversationsRes, blueroomPostsRes] = await Promise.all([
      supabase.from("intakes").select("id").eq("nurse_id", nurse_id),
      supabase.from("conversations").select("id").eq("nurse_id", nurse_id),
      supabase.from("blueroom_posts").select("id").eq("nurse_id", nurse_id),
    ]);

    const intakeIds = (intakesRes.data ?? []).map(i => i.id as string);
    const conversationIds = (conversationsRes.data ?? []).map(c => c.id as string);
    const postIds = (blueroomPostsRes.data ?? []).map(p => p.id as string);

    // ── 2. Deepest children first ─────────────────────────────────────────────

    // Reviews linked to intakes
    if (intakeIds.length > 0) {
      await supabase.from("reviews").delete().in("intake_id", intakeIds);
    }

    // Healing chats (by conversation_id if that FK exists, then by nurse_id)
    if (conversationIds.length > 0) {
      await supabase.from("healing_chats").delete().in("conversation_id", conversationIds);
    }
    await supabase.from("healing_chats").delete().eq("nurse_id", nurse_id);

    // BlueRoom child records
    if (postIds.length > 0) {
      await supabase.from("blueroom_comments").delete().in("post_id", postIds);
      await supabase.from("blueroom_post_reactions").delete().in("post_id", postIds);
      await supabase.from("blueroom_post_views").delete().in("post_id", postIds);
    }
    await supabase.from("blueroom_comments").delete().eq("nurse_id", nurse_id);
    await supabase.from("blueroom_post_reactions").delete().eq("nurse_id", nurse_id);
    await supabase.from("blueroom_comment_reactions").delete().eq("nurse_id", nurse_id);
    await supabase.from("blueroom_notifications").delete().eq("nurse_id", nurse_id);
    await supabase.from("blueroom_post_views").delete().eq("nurse_id", nurse_id);
    await supabase.from("blueroom_posts").delete().eq("nurse_id", nurse_id);

    // Loyalty & referrals
    await supabase.from("loyalty_points").delete().eq("nurse_id", nurse_id);
    await supabase.from("loyalty_programs").delete().eq("nurse_id", nurse_id);
    await supabase.from("referrals").delete().eq("nurse_id", nurse_id);

    // Emergency keywords
    await supabase.from("emergency_keywords").delete().eq("nurse_id", nurse_id);

    // Procedures
    await supabase.from("procedures").delete().eq("nurse_id", nurse_id);

    // Treatments
    await supabase.from("treatments").delete().eq("nurse_id", nurse_id);

    // Intakes
    await supabase.from("intakes").delete().eq("nurse_id", nurse_id);

    // Conversations
    await supabase.from("conversations").delete().eq("nurse_id", nurse_id);

    // Feedback
    await supabase.from("feedback").delete().eq("nurse_id", nurse_id);

    // Admins
    await supabase.from("admins").delete().eq("user_id", nurse_id);

    // ── 3. Bot row (parent) ───────────────────────────────────────────────────
    await supabase.from("bots").delete().eq("nurse_id", nurse_id);

    // ── 4. Supabase auth user ─────────────────────────────────────────────────
    await supabase.auth.admin.deleteUser(nurse_id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
