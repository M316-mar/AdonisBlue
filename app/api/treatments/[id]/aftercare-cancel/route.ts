import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logError } from "@/lib/logError";

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

    // Ownership check + already-sent guard
    const { data: treatment, error: tErr } = await supabase
      .from("treatments")
      .select("id, aftercare_sent_at")
      .eq("id", id)
      .eq("nurse_id", user.id)
      .single();

    if (tErr || !treatment) return NextResponse.json({ error: "Treatment not found" }, { status: 404 });

    if (treatment.aftercare_sent_at) {
      return NextResponse.json({ ok: false, already_sent: true, sent_at: treatment.aftercare_sent_at });
    }

    // Cancel = remove from DB queue + record the decision so the Assistant
    // knows not to re-surface this treatment as "needs aftercare".
    const { error: updateErr } = await supabase
      .from("treatments")
      .update({ aftercare_send_at: null, aftercare_claimed_at: null, aftercare_canceled_at: new Date().toISOString() })
      .eq("id", id)
      .eq("nurse_id", user.id);

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
