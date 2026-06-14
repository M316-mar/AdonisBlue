import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [botsRes, intakesRes, conversationsRes, feedbackRes] = await Promise.all([
      supabase
        .from("bots")
        .select("practice_name, bot_name, slug, launched, frozen, created_at, nurse_id, plan, trial_ends_at, subscription_status")
        .order("created_at", { ascending: false }),
      supabase
        .from("intakes")
        .select("nurse_id, survey_sent, aftercare_sent_at, created_at"),
      supabase
        .from("conversations")
        .select("nurse_id, created_at"),
      supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);

    const bots = botsRes.data ?? [];
    const intakes = intakesRes.data ?? [];
    const conversations = conversationsRes.data ?? [];
    const feedbackRows = feedbackRes.data ?? [];

    const nurses = bots.map(bot => {
      const nurseIntakes = intakes.filter(i => i.nurse_id === bot.nurse_id);
      const nurseConversations = conversations.filter(c => c.nurse_id === bot.nurse_id);
      const sorted = [...nurseIntakes].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const lastIntake = sorted[0];

      // Compute trial_ends_at fallback from created_at if column not yet populated
      const trialEndsAt =
        bot.trial_ends_at ??
        new Date(new Date(bot.created_at).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

      return {
        ...bot,
        plan: bot.plan ?? "trial",
        trial_ends_at: trialEndsAt,
        subscription_status: bot.subscription_status ?? "trial",
        total_intakes: nurseIntakes.length,
        total_conversations: nurseConversations.length,
        reviews_sent: nurseIntakes.filter(i => i.survey_sent).length,
        aftercare_sent: nurseIntakes.filter(i => i.aftercare_sent_at).length,
        last_active: lastIntake?.created_at ?? bot.created_at,
      };
    });

    return NextResponse.json({ nurses, feedback: feedbackRows });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
