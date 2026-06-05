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

    // Get all conversations for this nurse
    const { data: conversations } = await supabase
      .from("conversations")
      .select("*")
      .eq("nurse_id", nurse_id)
      .order("created_at", { ascending: false })
      .limit(100);

    // Get total intakes
    const { data: intakes } = await supabase
      .from("intakes")
      .select("service_interested, referred_by, created_at")
      .eq("nurse_id", nurse_id);

    // Analyze what clients are asking
    const allMessages = (conversations ?? []).flatMap(c =>
      (c.messages ?? []).filter((m: { role: string }) => m.role === "user").map((m: { content: string }) => m.content)
    );

    // Count service interests
    const serviceCount: Record<string, number> = {};
    (intakes ?? []).forEach(i => {
      if (i.service_interested) {
        serviceCount[i.service_interested] = (serviceCount[i.service_interested] || 0) + 1;
      }
    });

    // Count referral sources
    const referralCount: Record<string, number> = {};
    (intakes ?? []).forEach(i => {
      if (i.referred_by) {
        referralCount[i.referred_by] = (referralCount[i.referred_by] || 0) + 1;
      }
    });

    // Common question keywords
    const keywords = ["price", "cost", "hurt", "pain", "safe", "booking", "book", "filler", "botox", "lip", "cheek", "prp", "appointment", "long", "last", "result", "before", "after", "bruise", "swelling", "recovery"];
    const keywordCount: Record<string, number> = {};
    keywords.forEach(kw => {
      keywordCount[kw] = allMessages.filter(m =>
        m.toLowerCase().includes(kw)
      ).length;
    });

    // Sort by most asked
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
      totalConversations: conversations?.length ?? 0,
      totalIntakes: intakes?.length ?? 0,
      topQuestions,
      topServices,
      topReferrals,
      recentConversations: conversations?.slice(0, 5) ?? [],
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
