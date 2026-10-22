import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logError";
import { promoteScheduledAftercares } from "@/lib/promoteScheduledAftercares";

const resend = new Resend(process.env.RESEND_API_KEY);
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id || !UUID_REGEX.test(id)) {
      return NextResponse.json({ error: "Invalid treatment id" }, { status: 400 });
    }

    const token = request.headers.get("authorization")?.replace("Bearer ", "").trim();
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

    // Fetch treatment with ownership check
    const { data: treatment, error: tErr } = await supabase
      .from("treatments")
      .select("id, nurse_id, intake_id, aftercare_send_at, aftercare_sent_at")
      .eq("id", id)
      .eq("nurse_id", user.id)
      .single();

    if (tErr || !treatment) return NextResponse.json({ error: "Treatment not found" }, { status: 404 });

    // If already sent (promotion ran) — can't cancel
    if (treatment.aftercare_sent_at) {
      return NextResponse.json({ ok: false, already_sent: true, sent_at: treatment.aftercare_sent_at });
    }

    // Find the scheduled message_log row
    const { data: logRow } = await supabase
      .from("message_log")
      .select("provider_id")
      .eq("treatment_id", id)
      .eq("type", "aftercare")
      .eq("status", "scheduled")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const providerId = logRow?.provider_id as string | null;

    if (providerId) {
      const { error: cancelErr } = await resend.emails.cancel(providerId);
      if (cancelErr) {
        // Resend says it's already delivered — promote and tell the UI
        await promoteScheduledAftercares(supabase);
        const { data: refreshed } = await supabase
          .from("treatments")
          .select("aftercare_sent_at")
          .eq("id", id)
          .single();
        return NextResponse.json({
          ok: false,
          already_sent: true,
          sent_at: refreshed?.aftercare_sent_at ?? treatment.aftercare_send_at,
        });
      }

      // Mark the scheduled log row as canceled
      await supabase
        .from("message_log")
        .update({ status: "canceled" })
        .eq("treatment_id", id)
        .eq("type", "aftercare")
        .eq("status", "scheduled");
    }

    // Clear aftercare_send_at — aftercare_sent_at stays NULL (nurse can send manually later)
    const { error: updateErr } = await supabase
      .from("treatments")
      .update({ aftercare_send_at: null })
      .eq("id", id);

    if (updateErr) {
      await logError("aftercare-cancel", updateErr.message);
      return NextResponse.json({ error: "Failed to cancel" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    await logError("aftercare-cancel", String(e));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
