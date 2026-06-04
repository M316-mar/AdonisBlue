import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: bots } = await supabase
      .from("bots")
      .select("practice_name, bot_name, slug, launched, frozen, created_at, nurse_id")
      .order("created_at", { ascending: false });

    const { data: intakes } = await supabase
      .from("intakes")
      .select("nurse_id, survey_sent, aftercare_sent_at, created_at");

    const { data: feedbackRows } = await supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false });

    // Attach intake counts to each nurse
    const nurses = (bots ?? []).map(bot => {
      const nurseIntakes = (intakes ?? []).filter(i => i.nurse_id === bot.nurse_id);
      const lastIntake = nurseIntakes.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      return {
        ...bot,
        total_intakes: nurseIntakes.length,
        reviews_sent: nurseIntakes.filter(i => i.survey_sent).length,
        aftercare_sent: nurseIntakes.filter(i => i.aftercare_sent_at).length,
        last_active: lastIntake?.created_at ?? bot.created_at,
      };
    });

    return NextResponse.json({ nurses, feedback: feedbackRows ?? [] });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
