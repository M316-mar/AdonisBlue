import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

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

    // Capture email + practice name BEFORE any deletes — both become unrecoverable once the account is gone
    let nurseEmail: string | null = null;
    let practiceName: string | null = null;
    try {
      const { data: authUser } = await db.auth.admin.getUserById(nurse_id);
      nurseEmail = authUser?.user?.email ?? null;
      const { data: botRow } = await db.from("bots").select("practice_name").eq("nurse_id", nurse_id).single();
      practiceName = botRow?.practice_name ?? null;
    } catch {
      // If this lookup fails, proceed with deletion anyway — just skip the notification
    }

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

    if (nurseEmail) {
      resend.emails.send({
        from: "AdonisBlue <hi@adonisblue.io>",
        to: nurseEmail,
        subject: "Your AdonisBlue account has been deleted",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <h2 style="color: #1a2744;">Your account has been deleted</h2>
            <p style="color: #475569;">Your AdonisBlue account${practiceName ? ` (${practiceName})` : ""} and all associated data have been permanently deleted.</p>
            <p style="color: #475569;">If you have any questions about this, reply to this email or contact us at hi@adonisblue.io.</p>
          </div>
        `,
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[delete-nurse] unexpected error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
