import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
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

    // Date boundaries for this month / last month
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    // Run all queries in parallel
    const [
      conversationsRes,
      intakesRes,
      treatmentsRes,
      healingChatsRes,
    ] = await Promise.all([
      supabase
        .from("conversations")
        .select("*")
        .eq("nurse_id", nurse_id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("intakes")
        .select("service_interested, referred_by, created_at, came_via_bot, came_via_booking, review_request_sent")
        .eq("nurse_id", nurse_id),
      supabase
        .from("treatments")
        .select("procedure_name, aftercare_sent, reminder_sent, created_at")
        .eq("nurse_id", nurse_id),
      supabase
        .from("healing_chats")
        .select("id")
        .eq("nurse_id", nurse_id)
        .eq("flagged", true),
    ]);

    const conversations = conversationsRes.data ?? [];
    const intakes = intakesRes.data ?? [];
    const treatments = treatmentsRes.data ?? [];
    const emergencyAlerts = healingChatsRes.data?.length ?? 0;

    // ── Bot & booking source counts ──────────────────────────────────────────
    const clientsFromBot = intakes.filter(i => i.came_via_bot === true).length;
    const clientsFromBooking = intakes.filter(i => i.came_via_booking === true).length;

    // ── Conversion rate ──────────────────────────────────────────────────────
    const totalConversations = conversations.length;
    const totalIntakes = intakes.length;
    const conversionRate =
      totalConversations > 0
        ? Math.round((totalIntakes / totalConversations) * 100)
        : 0;

    // ── Treatment metrics ─────────────────────────────────────────────────────
    const treatmentsLogged = treatments.length;
    const aftercareSent = treatments.filter(t => t.aftercare_sent === true).length;
    const remindersSent = treatments.filter(t => t.reminder_sent === true).length;

    // ── Review requests ───────────────────────────────────────────────────────
    const reviewsRequested = intakes.filter(i => i.review_request_sent === true).length;

    // ── This month vs last month ──────────────────────────────────────────────
    const intakesThisMonth = intakes.filter(
      i => i.created_at && i.created_at >= thisMonthStart
    ).length;
    const intakesLastMonth = intakes.filter(
      i => i.created_at && i.created_at >= lastMonthStart && i.created_at < lastMonthEnd
    ).length;

    // ── Top procedure ─────────────────────────────────────────────────────────
    const procedureCount: Record<string, number> = {};
    treatments.forEach(t => {
      if (t.procedure_name) {
        procedureCount[t.procedure_name] = (procedureCount[t.procedure_name] || 0) + 1;
      }
    });
    const topProcedure =
      Object.entries(procedureCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    // ── Service interests ─────────────────────────────────────────────────────
    const serviceCount: Record<string, number> = {};
    intakes.forEach(i => {
      if (i.service_interested) {
        serviceCount[i.service_interested] = (serviceCount[i.service_interested] || 0) + 1;
      }
    });

    // ── Referral sources ──────────────────────────────────────────────────────
    const referralCount: Record<string, number> = {};
    intakes.forEach(i => {
      if (i.referred_by) {
        referralCount[i.referred_by] = (referralCount[i.referred_by] || 0) + 1;
      }
    });

    // ── Keyword analysis ──────────────────────────────────────────────────────
    const allMessages = conversations.flatMap(c =>
      (c.messages ?? [])
        .filter((m: { role: string }) => m.role === "user")
        .map((m: { content: string }) => m.content)
    );

    const keywords = ["price", "cost", "hurt", "pain", "safe", "booking", "book", "filler", "botox", "lip", "cheek", "prp", "appointment", "long", "last", "result", "before", "after", "bruise", "swelling", "recovery"];
    const keywordCount: Record<string, number> = {};
    keywords.forEach(kw => {
      keywordCount[kw] = allMessages.filter(m => m.toLowerCase().includes(kw)).length;
    });

    const topQuestions = Object.entries(keywordCount)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([keyword, count]) => ({ keyword, count }));

    const topServices = Object.entries(serviceCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([service, count]) => ({ service, count }));

    const topReferrals = Object.entries(referralCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([source, count]) => ({ source, count }));

    return NextResponse.json({
      // Core
      totalConversations,
      totalIntakes,
      conversionRate,
      // Sources
      clientsFromBot,
      clientsFromBooking,
      // Treatments
      treatmentsLogged,
      aftercareSent,
      remindersSent,
      // Engagement
      reviewsRequested,
      emergencyAlerts,
      // Month comparison
      intakesThisMonth,
      intakesLastMonth,
      // Top procedure
      topProcedure,
      // Lists
      topQuestions,
      topServices,
      topReferrals,
      recentConversations: conversations.slice(0, 5),
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
