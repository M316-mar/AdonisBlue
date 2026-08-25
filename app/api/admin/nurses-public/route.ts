import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [botsRes, intakesRes, conversationsRes, feedbackRes, usersRes] = await Promise.all([
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
      supabase.auth.admin.listUsers({ perPage: 1000 }),
    ]);

    const bots = botsRes.data ?? [];
    const intakes = intakesRes.data ?? [];
    const conversations = conversationsRes.data ?? [];
    const feedbackRows = feedbackRes.data ?? [];
    const emailByUserId = new Map<string, string>();
    for (const u of usersRes.data?.users ?? []) {
      if (u.email) emailByUserId.set(u.id, u.email);
    }

    const botByNurseId = new Map(bots.map(b => [b.nurse_id, b]));

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
        email: emailByUserId.get(bot.nurse_id) ?? null,
        plan: bot.plan ?? "trial",
        trial_ends_at: trialEndsAt,
        subscription_status: bot.subscription_status ?? "trial",
        total_intakes: nurseIntakes.length,
        total_conversations: nurseConversations.length,
        reviews_sent: nurseIntakes.filter(i => i.survey_sent).length,
        aftercare_sent: nurseIntakes.filter(i => i.aftercare_sent_at).length,
        last_active: lastIntake?.created_at ?? bot.created_at,
        onboarding_complete: true,
      };
    });

    // Include auth users who signed up but never completed onboarding (no bots row)
    for (const u of usersRes.data?.users ?? []) {
      if (botByNurseId.has(u.id)) continue; // already included above
      nurses.push({
        nurse_id: u.id,
        email: u.email ?? null,
        practice_name: null,
        bot_name: null,
        slug: null,
        launched: false,
        frozen: false,
        created_at: u.created_at,
        plan: "trial",
        trial_ends_at: new Date(new Date(u.created_at).getTime() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        subscription_status: "trial",
        total_intakes: 0,
        total_conversations: 0,
        reviews_sent: 0,
        aftercare_sent: 0,
        last_active: u.created_at,
        onboarding_complete: false,
      } as any);
    }

    return NextResponse.json({ nurses, feedback: feedbackRows });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
