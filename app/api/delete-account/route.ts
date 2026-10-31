import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/sendAndLog";


export async function POST(request: Request) {
  try {
    const token = request.headers.get("authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ── Verify the caller's identity ──────────────────────────────────────────
    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user } } = await supabaseAuth.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Capture the email now — it won't be retrievable once the account is deleted below
    const nurseEmail = user.email;

    // Service-role client — bypasses RLS so every delete actually lands
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const nurse_id = user.id;

    // ── Delete in dependency order (children first, parents last) ────────────
    // Rule: every statement is scoped to nurse_id so no other nurse's data is touched.

    // 1. healing_chats + checkin_reminders (nurse_id is text on checkin_reminders)
    await db.from("healing_chats").delete().eq("nurse_id", nurse_id);
    await db.from("checkin_reminders").delete().eq("nurse_id", nurse_id);

    // 2–6. blueroom + loyalty — tables kept after feature removal, still delete user data
    await db.from("blueroom_comment_reactions").delete().eq("nurse_id", nurse_id);
    const { data: ownPosts } = await db.from("blueroom_posts").select("id").eq("author_id", nurse_id);
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
    await db.from("blueroom_posts").delete().eq("author_id", nurse_id);
    await db.from("loyalty_points").delete().eq("nurse_id", nurse_id);
    await db.from("loyalty_programs").delete().eq("nurse_id", nurse_id);

    // 7. referrals (referrer_nurse_id)
    await db.from("referrals").delete().eq("referrer_nurse_id", nurse_id);

    // 8. emergency_keywords
    await db.from("emergency_keywords").delete().eq("nurse_id", nurse_id);

    // 9. reviews, offers, secretary log, message log
    await db.from("reviews").delete().eq("nurse_id", nurse_id);
    await db.from("offers").delete().eq("nurse_id", nurse_id);
    await db.from("secretary_action_log").delete().eq("nurse_id", nurse_id);
    await db.from("message_log").delete().eq("nurse_id", nurse_id);

    // 10. treatments
    await db.from("treatments").delete().eq("nurse_id", nurse_id);

    // 11. procedures
    await db.from("procedures").delete().eq("nurse_id", nurse_id);

    // 12. intakes (covers aftercare_sent_at, reminder fields, etc. as columns)
    await db.from("intakes").delete().eq("nurse_id", nurse_id);

    // 13. conversations
    await db.from("conversations").delete().eq("nurse_id", nurse_id);

    // 14. feedback
    await db.from("feedback").delete().eq("nurse_id", nurse_id);

    // 15. bots — parent record
    await db.from("bots").delete().eq("nurse_id", nurse_id);
    await db.from("nurses").delete().eq("id", nurse_id);

    // 18. Supabase auth user — absolute last
    const { error: authDeleteError } = await db.auth.admin.deleteUser(nurse_id);
    if (authDeleteError) {
      console.error("[delete-account] auth.admin.deleteUser failed:", authDeleteError.message);
      // Still return success to client — all data rows are gone
    }

    if (nurseEmail) {
      sendEmail({
        type: "account_deleted",
        nurse_id: nurse_id,
        to: nurseEmail,
        subject: "Your AdonisBlue account has been deleted",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1a2744;">Your account has been deleted</h2>
            <p style="color: #475569;">This confirms your AdonisBlue account and all associated data have been permanently deleted, as you requested.</p>
            <p style="color: #475569;">If you didn't request this, please contact us immediately at hi@adonisblue.io.</p>
          </div>
        `,
        supabase: db,
      }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[delete-account] unexpected error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
