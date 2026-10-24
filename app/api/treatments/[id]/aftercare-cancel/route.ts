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

    // Fetch treatment with ownership check — include aftercare_provider_id (set at schedule time)
    const { data: treatment, error: tErr } = await supabase
      .from("treatments")
      .select("id, nurse_id, intake_id, aftercare_send_at, aftercare_sent_at, aftercare_provider_id")
      .eq("id", id)
      .eq("nurse_id", user.id)
      .single();

    if (tErr || !treatment) return NextResponse.json({ error: "Treatment not found" }, { status: 404 });

    // If already sent (promotion ran) — can't cancel
    if (treatment.aftercare_sent_at) {
      return NextResponse.json({ ok: false, already_sent: true, sent_at: treatment.aftercare_sent_at });
    }

    // aftercare_provider_id is written at schedule time — it is the canonical source for the Resend id.
    // Fall back to message_log for rows scheduled before this column existed.
    let providerId: string | null = (treatment as any).aftercare_provider_id ?? null;

    if (!providerId) {
      const { data: logRow } = await supabase
        .from("message_log")
        .select("provider_id")
        .eq("treatment_id", id)
        .eq("type", "aftercare")
        .eq("status", "scheduled")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      providerId = (logRow?.provider_id as string | null) ?? null;
    }

    if (!providerId) {
      await logError(
        "aftercare-cancel",
        `No provider_id found for treatment ${id} — cannot cancel with Resend`
      );
      return NextResponse.json({
        ok: false,
        error: "Couldn't cancel — it may still send. Contact support.",
      }, { status: 500 });
    }

    // Ask Resend to cancel the scheduled email
    const { error: cancelErr } = await resend.emails.cancel(providerId);

    if (cancelErr) {
      // statusCode 422 typically means the email was already sent/delivered
      const alreadySent =
        (cancelErr as { statusCode?: number }).statusCode === 422 ||
        (cancelErr as { name?: string }).name === "validation_error";

      await logError(
        "aftercare-cancel",
        `Resend cancel failed for provider_id ${providerId}: ${cancelErr.message ?? String(cancelErr)}`
      );

      if (alreadySent) {
        // Promote and surface the sent_at to the UI
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

      // Some other Resend error (network, auth, unknown) — don't pretend cancel succeeded
      return NextResponse.json({
        ok: false,
        error: "Couldn't cancel — it may still send. Try again.",
      }, { status: 502 });
    }

    // Resend confirmed cancel — mark the log row, clear the treatment fields
    await supabase
      .from("message_log")
      .update({ status: "canceled" })
      .eq("treatment_id", id)
      .eq("type", "aftercare")
      .eq("status", "scheduled");

    const { error: updateErr } = await supabase
      .from("treatments")
      .update({ aftercare_send_at: null, aftercare_provider_id: null })
      .eq("id", id);

    if (updateErr) {
      await logError("aftercare-cancel", updateErr.message);
      return NextResponse.json({ error: "Failed to update treatment" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    await logError("aftercare-cancel", String(e));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
